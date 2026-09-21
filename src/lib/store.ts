import { useCallback, useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useAuth } from './auth'
import { db, hasFirebase } from './firebase'
import { SAMPLE } from './sample'
import type { CollectionName, Entity } from './types'

const LOCAL_PREFIX = 'jd:'
const listeners = new Map<CollectionName, Set<() => void>>()

function readLocal<T>(name: CollectionName): T[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PREFIX + name) ?? '[]') as T[]
  } catch {
    return []
  }
}

function writeLocal<T>(name: CollectionName, items: T[]) {
  localStorage.setItem(LOCAL_PREFIX + name, JSON.stringify(items))
  listeners.get(name)?.forEach((fn) => fn())
}

/**
 * 컬렉션을 구독한다. Firebase 설정이 없으면 localStorage를 사용한다.
 * @param name 컬렉션 이름
 * @param enabled false면 구독하지 않는다
 *
 * 비공개 컬렉션(jobs/docs/todos)은 소유자가 아니면 구독하지 않고, 블러 화면용 가짜 샘플을 돌려준다.
 */
export function useCollection<T extends Entity>(name: CollectionName, enabled = true) {
  const { isOwner, ready: authReady } = useAuth()
  const locked = name !== 'study' && !isOwner
  const [items, setItems] = useState<T[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (locked || !authReady) return
    if (!enabled) {
      setItems([])
      setReady(false)
      return
    }
    if (hasFirebase && db) {
      return onSnapshot(
        collection(db, name),
        (snap) => {
          setItems(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })))
          setReady(true)
        },
        (err) => {
          console.error(`[${name}] 구독 실패`, err)
          setReady(true)
        },
      )
    }
    const load = () => {
      setItems(readLocal<T>(name))
      setReady(true)
    }
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name)!.add(load)
    load()
    return () => {
      listeners.get(name)?.delete(load)
    }
  }, [name, enabled, locked, authReady])

  if (locked) return { items: SAMPLE[name as Exclude<CollectionName, 'study'>] as unknown as T[], ready: true, locked }
  return { items, ready, locked }
}

type NewOrExisting<T extends Entity> = Omit<T, 'createdAt' | 'updatedAt'> & Partial<Pick<Entity, 'createdAt' | 'updatedAt'>>

/** 문서를 저장(생성/수정)한다. createdAt/updatedAt은 자동으로 채운다. */
export async function saveItem<T extends Entity>(name: CollectionName, item: NewOrExisting<T>) {
  const now = Date.now()
  const full = { ...item, createdAt: item.createdAt ?? now, updatedAt: now } as T
  if (hasFirebase && db) {
    await setDoc(doc(db, name, full.id), full)
    return
  }
  const list = readLocal<T>(name)
  const idx = list.findIndex((x) => x.id === full.id)
  if (idx >= 0) list[idx] = full
  else list.push(full)
  writeLocal(name, list)
}

export async function removeItem(name: CollectionName, id: string) {
  if (hasFirebase && db) {
    await deleteDoc(doc(db, name, id))
    return
  }
  writeLocal(
    name,
    readLocal<Entity>(name).filter((x) => x.id !== id),
  )
}

/** 저장/삭제 함수를 컬렉션에 묶어서 돌려준다 */
export function useCrud<T extends Entity>(name: CollectionName) {
  const save = useCallback((item: NewOrExisting<T>) => saveItem<T>(name, item), [name])
  const remove = useCallback((id: string) => removeItem(name, id), [name])
  return { save, remove }
}

/** 백업 복원: 백업 JSON의 모든 컬렉션을 다시 저장한다 */
export async function importAll(data: Partial<Record<CollectionName, Entity[]>>) {
  const names: CollectionName[] = ['study', 'jobs', 'docs', 'todos']
  for (const n of names) {
    for (const item of data[n] ?? []) await saveItem(n, item)
  }
}
