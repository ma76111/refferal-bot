import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import robotVideo from '../assets/robot.webm'

const BOT_NAME = import.meta.env.VITE_BOT_NAME || 'YourBot'

// callback خارج الـ component
let _loginCallback = null
window.onTelegramAuth = (data) => {
  console.log('[TelegramAuth] data:', data)
  if (_loginCallback) _loginCallback(data)
}

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const widgetRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  // معالجة redirect callback من تيليجرام
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tgData = {}
    let hasTgData = false

    for (const [key, value] of params.entries()) {
      if (['id','first_name','last_name','username','photo_url','auth_date','hash'].includes(key)) {
        tgData[key] = value
        hasTgData = true
      }
    }

    if (hasTgData && tgData.hash) {
      console.log('[TelegramAuth] Redirect data:', tgData)
      // امسح الـ params من URL
      window.history.replaceState({}, '', '/login')
      api.post('/auth/telegram', tgData)
        .then(res => {
          login(res.data.token, res.data.user)
          navigate('/')
        })
        .catch(err => {
          alert(err.response?.data?.error || err.message || 'Login failed')
        })
    }
  }, [])

  useEffect(() => {
    _loginCallback = async (data) => {
      try {
        const res = await api.post('/auth/telegram', data)
        login(res.data.token, res.data.user)
        navigate('/')
      } catch (err) {
        alert(err.response?.data?.error || err.message || 'Login failed')
      }
    }

    const oldScript = document.querySelector('script[data-telegram-login]')
    if (oldScript) oldScript.remove()

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_NAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-auth-url', window.location.origin + '/login')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    script.onload = () => console.log('[TelegramAuth] script loaded')
    script.onerror = () => console.error('[TelegramAuth] script failed')

    if (widgetRef.current) {
      widgetRef.current.innerHTML = ''
      widgetRef.current.appendChild(script)
    }
  }, [])

  return (
    <div className="login-page">
      <div className="particles">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${(i * 6.2) % 100}%`,
            animationDelay: `${(i * 0.5) % 8}s`,
            animationDuration: `${7 + (i % 5)}s`,
            fontSize: `${10 + (i % 3) * 5}px`,
            opacity: 0.12 + (i % 4) * 0.06
          }}>
            {['⛏️','💎','🪙','⭐','✨','🔷'][i % 6]}
          </div>
        ))}
      </div>

      <div className="login-card">
        <div className="robot-container">
          <video
            src={robotVideo}
            autoPlay loop muted playsInline
            style={{ width: '280px', height: 'auto', filter: 'drop-shadow(0 0 30px rgba(56,189,248,0.35))' }}
          />
        </div>
        <h1 className="login-title">Workers Bot</h1>
        <p className="login-subtitle">⛏️ اعمل · اكسب · انسحب</p>
        <div className="login-divider"/>
        <p className="login-desc">سجّل دخولك بحساب تيليجرام للبدء</p>
        <div ref={widgetRef} className="tg-widget" />
        <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '8px' }}>
          إذا لم يظهر زر تيليجرام،{' '}
          <a href={`https://t.me/${BOT_NAME}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            افتح البوت أولاً
          </a>
          {' '}ثم أعد تحميل الصفحة
        </p>
        <p className="login-hint">🔒 يجب أن تكون قد فتحت البوت مسبقاً</p>
      </div>
    </div>
  )
}
