import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Layout from './components/Layout'
import Home from './pages/Home'
import Study from './pages/Study'
import Jobs from './pages/Jobs'
import Calendar from './pages/Calendar'
import Docs from './pages/Docs'
import Todos from './pages/Todos'
import Settings from './pages/Settings'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="study" element={<Study />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="docs" element={<Docs />} />
            <Route path="todos" element={<Todos />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
