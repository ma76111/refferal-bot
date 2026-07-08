import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import robotVideo from '../assets/robot.webm'

const BOT_NAME = import.meta.env.VITE_BOT_NAME || 'YourBot'

// تعريف الـ callback خارج الـ component عشان تيليجرام يلاقيها دايماً
let _loginCallback = null
window.onTelegramAuth = (data) => {
  console.log('%c[LOGIN MONITOR] ✅ onTelegramAuth تم استدعاؤها!', 'color: lime; font-weight: bold')
  console.log('[LOGIN MONITOR] البيانات المستلمة:', data)
  if (_loginCallback) {
    _loginCallback(data)
  } else {
    console.error('[LOGIN MONITOR] ❌ _loginCallback غير معرّف!')
  }
}

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const widgetRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  useEffect(() => {
    console.log('%c[LOGIN MONITOR] 🚀 صفحة تسجيل الدخول تحملت', 'color: cyan; font-weight: bold')
    console.log('[LOGIN MONITOR] BOT_NAME:', BOT_NAME)
    console.log('[LOGIN MONITOR] Current URL:', window.location.href)

    // ربط الـ callback بالـ component
    _loginCallback = async (data) => {
      try {
        console.log('[LOGIN MONITOR] 📡 إرسال للسيرفر...')
        const res = await api.post('/auth/telegram', data)
        console.log('[LOGIN MONITOR] ✅ رد السيرفر:', res.data)
        login(res.data.token, res.data.user)
        navigate('/')
      } catch (err) {
        console.error('%c[LOGIN MONITOR] ❌ خطأ من السيرفر:', 'color: red; font-weight: bold', err.response?.status, err.response?.data)
        alert(err.response?.data?.error || err.message || 'Login failed. Please try again or contact support.')
      }
    }

    // مراقبة postMessage
    const messageHandler = (event) => {
      if (event.origin.includes('telegram')) {
        console.log('%c[LOGIN MONITOR] 📨 postMessage من تيليجرام!', 'color: lime; font-weight: bold')
        console.log('[LOGIN MONITOR] البيانات:', event.data)
      }
    }
    window.addEventListener('message', messageHandler)

    // إزالة السكريبت القديم
    const oldScript = document.querySelector('script[data-telegram-login]')
    if (oldScript) oldScript.remove()

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_NAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    script.onload = () => console.log('%c[LOGIN MONITOR] ✅ سكريبت تيليجرام تحمّل', 'color: lime; font-weight: bold')
    script.onerror = (e) => console.error('[LOGIN MONITOR] ❌ فشل تحميل سكريبت تيليجرام!', e)

    if (widgetRef.current) {
      widgetRef.current.innerHTML = ''
      widgetRef.current.appendChild(script)
    }

    return () => {
      window.removeEventListener('message', messageHandler)
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
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '280px',
              height: 'auto',
              filter: 'drop-shadow(0 0 30px rgba(56,189,248,0.35))'
            }}
          />
        </div>

        <h1 className="login-title">Workers Bot</h1>
        <p className="login-subtitle">⛏️ اعمل · اكسب · انسحب</p>
        <div className="login-divider"/>
        <p className="login-desc">سجّل دخولك بحساب تيليجرام للبدء</p>
        <div ref={widgetRef} className="tg-widget" />
        <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '8px' }}>
          إذا لم يظهر زر تيليجرام،{' '}
          <a
            href={`https://t.me/${BOT_NAME}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            افتح البوت أولاً
          </a>
          {' '}ثم أعد تحميل الصفحة
        </p>
        <p className="login-hint">🔒 يجب أن تكون قد فتحت البوت مسبقاً</p>
      </div>
    </div>
  )
}
