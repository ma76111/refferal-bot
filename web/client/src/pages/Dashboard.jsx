import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/user/stats').then(r => setStats(r.data))
  }, [])

  return (
    <div className="page">
      <h2>مرحباً {user?.username ? `@${user.username}` : `#${user?.telegram_id}`} 👋</h2>

      <div className="cards-grid">
        <div className="card accent">
          <span className="card-icon">💰</span>
          <div>
            <div className="card-label">الرصيد</div>
            <div className="card-value">{parseFloat(user?.balance || 0).toFixed(2)} USDT</div>
          </div>
        </div>
        <div className="card">
          <span className="card-icon">🔄</span>
          <div>
            <div className="card-label">نقاط التبادل</div>
            <div className="card-value">{user?.exchange_points || 0}</div>
          </div>
        </div>
        <div className="card">
          <span className="card-icon">✅</span>
          <div>
            <div className="card-label">مهام مكتملة</div>
            <div className="card-value">{stats?.completed_submissions || 0}</div>
          </div>
        </div>
        <div className="card">
          <span className="card-icon">📋</span>
          <div>
            <div className="card-label">مهام نشطة</div>
            <div className="card-value">{stats?.active_tasks || 0}</div>
          </div>
        </div>
        <div className="card">
          <span className="card-icon">⏳</span>
          <div>
            <div className="card-label">قيد المراجعة</div>
            <div className="card-value">{stats?.pending_submissions || 0}</div>
          </div>
        </div>
        <div className="card">
          <span className="card-icon">📥</span>
          <div>
            <div className="card-label">إجمالي الإيداعات</div>
            <div className="card-value">{parseFloat(stats?.total_deposited || 0).toFixed(2)} USDT</div>
          </div>
        </div>
      </div>
    </div>
  )
}
