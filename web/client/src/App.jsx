import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import { ToastProvider } from './components/Toast'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import MyTasks from './pages/MyTasks'
import Submissions from './pages/Submissions'
import Wallet from './pages/Wallet'
import Tickets from './pages/Tickets'
import Admin from './pages/Admin'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="full-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="full-center"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"       element={<Login />} />
              <Route path="/"            element={<Protected><Dashboard /></Protected>} />
              <Route path="/tasks"       element={<Protected><Tasks /></Protected>} />
              <Route path="/my-tasks"    element={<Protected><MyTasks /></Protected>} />
              <Route path="/submissions" element={<Protected><Submissions /></Protected>} />
              <Route path="/wallet"      element={<Protected><Wallet /></Protected>} />
              <Route path="/tickets"     element={<Protected><Tickets /></Protected>} />
              <Route path="/admin"       element={<AdminOnly><Admin /></AdminOnly>} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
