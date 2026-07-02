import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

const BOT_NAME = import.meta.env.VITE_BOT_NAME || 'YourBot'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const widgetRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  useEffect(() => {
    // Telegram Login Widget callback
    window.onTelegramAuth = async (data) => {
      try {
        const res = await api.post('/auth/telegram', data)
        login(res.data.token, res.data.user)
        navigate('/')
      } catch (err) {
        alert(err.response?.data?.error || 'Login failed')
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_NAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    widgetRef.current?.appendChild(script)

    return () => { delete window.onTelegramAuth }
  }, [])

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>Affiliates Bot</h1>
        <p>سجّل دخولك بحساب تيليجرام</p>
        <div ref={widgetRef} className="tg-widget" />
        <p className="login-hint">يجب أن تكون قد فتحت البوت مسبقاً</p>
      </div>
    </div>
  )
}
