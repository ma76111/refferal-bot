import { useEffect, useState } from 'react'
import api from '../api'

const STATUS = {
  pending: { label: 'قيد المراجعة', cls: 'pending' },
  accept:  { label: 'مقبول ✅',      cls: 'accepted' },
  reject:  { label: 'مرفوض ❌',      cls: 'rejected' },
}

export default function Submissions() {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks/submissions').then(r => setSubs(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h2>إثباتاتي ({subs.length})</h2>
      {subs.length === 0 && <p className="empty">لم تقدم أي إثباتات بعد</p>}
      <div className="task-list">
        {subs.map(s => {
          const st = STATUS[s.status] || { label: s.status, cls: '' }
          return (
            <div key={s.id} className="task-card">
              <div className="task-header">
                <span className="task-bot">🤖 {s.bot_name}</span>
                <span className={`badge ${st.cls}`}>{st.label}</span>
              </div>
              <div className="task-meta">
                {s.task_type === 'paid'
                  ? <span>💰 {s.reward_per_user} USDT</span>
                  : <span>🔄 تبادل</span>}
                <span>📅 {new Date(s.created_at).toLocaleDateString('ar')}</span>
                {s.owner_username && <span>👤 @{s.owner_username}</span>}
              </div>
              {s.reject_message && (
                <div className="reject-msg">
                  ❌ {s.reject_message}
                  {s.can_retry ? <span className="retry-badge"> (يمكن إعادة المحاولة)</span> : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
