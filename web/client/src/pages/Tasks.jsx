import { useEffect, useState } from 'react'
import api from '../api'

const TYPE_LABELS = { paid: 'مدفوعة', exchange: 'تبادل' }
const PROOF_LABELS = { text: 'نص', images: 'صور', both: 'نص + صور' }

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks').then(r => setTasks(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h2>المهام المتاحة ({tasks.length})</h2>
      {tasks.length === 0 && <p className="empty">لا توجد مهام متاحة حالياً</p>}
      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} className={`task-card ${task.is_owner ? 'owned' : ''}`}>
            <div className="task-header">
              <span className="task-bot">🤖 {task.bot_name}</span>
              {task.is_owner && <span className="badge own">مهمتك</span>}
              <span className={`badge ${task.task_type}`}>{TYPE_LABELS[task.task_type]}</span>
            </div>

            <div className="task-reward">
              {task.task_type === 'paid'
                ? <span className="reward-paid">💰 {task.reward_per_user} USDT</span>
                : <span className="reward-exchange">🔄 +1 نقطة تبادل</span>}
            </div>

            <div className="task-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min((task.completed_count / task.required_count) * 100, 100)}%` }}
                />
              </div>
              <span>{task.completed_count}/{task.required_count}</span>
            </div>

            <div className="task-meta">
              <span>📸 {PROOF_LABELS[task.proof_type]}</span>
              {task.owner_rating_count > 0 && (
                <span>⭐ {task.owner_rating}/5 ({task.owner_rating_count})</span>
              )}
            </div>

            {task.verification_instructions && (
              <p className="task-instructions">{task.verification_instructions}</p>
            )}

            {!task.is_owner && (
              <a href={task.referral_link} target="_blank" rel="noopener noreferrer" className="btn-primary">
                تنفيذ المهمة ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
