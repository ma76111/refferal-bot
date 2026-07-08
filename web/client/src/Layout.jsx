import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import NotificationBell from './components/NotificationBell'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-layout">
      <header className="topbar">
        <span className="brand">⛏️ Workers Bot</span>
        <div className="user-info">
          <button className="theme-toggle" onClick={toggle} title="تبديل المظهر">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <span>{user?.username ? `@${user.username}` : `#${user?.telegram_id}`}</span>
          <span className="balance-chip">💰 {parseFloat(user?.balance || 0).toFixed(2)}</span>
          <button className="logout-btn" onClick={handleLogout}>🚪 خروج</button>
        </div>
      </header>

      <nav className="sidebar">
        <NavLink to="/"            end><span>📊</span> الرئيسية</NavLink>
        <NavLink to="/tasks">          <span>📋</span> المهام</NavLink>
        <NavLink to="/my-tasks">       <span>📌</span> مهامي</NavLink>
        <NavLink to="/submissions">    <span>📝</span> إثباتاتي</NavLink>
        <NavLink to="/wallet">         <span>💳</span> المحفظة</NavLink>
        <NavLink to="/tickets">        <span>🎫</span> الدعم</NavLink>
        {user?.is_admin && (
          <NavLink to="/admin">        <span>⚙️</span> لوحة التحكم</NavLink>
        )}
      </nav>

      <main className="content">{children}</main>
    </div>
  )
}
