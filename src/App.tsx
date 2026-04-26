import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import DeckEditor from './pages/DeckEditor'
import Train from './pages/Train'

export default function App() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        К содержимому
      </a>
      <header className="app-bar">
        <span className="brand">RU → EN</span>
        <nav className="nav" aria-label="Основная навигация">
          <NavLink
            to="/train"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Тренировка
          </NavLink>
          <NavLink
            to="/deck"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Словарь
          </NavLink>
        </nav>
      </header>
      <main id="main" className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/train" replace />} />
          <Route path="/train" element={<Train />} />
          <Route path="/deck" element={<DeckEditor />} />
          <Route path="*" element={<Navigate to="/train" replace />} />
        </Routes>
      </main>
    </div>
  )
}
