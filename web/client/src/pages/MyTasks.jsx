import { useEffect, useState } from 'react'
import api from '../api'

const STATUS_LABELS = { active: '🟢 نشطة', completed: '✅ مكتملة', cancelled: '❌ ملغية' }

export default function MyTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks/mine').then(r => setTasks(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h2>مهامي ({tasks.length})</h2>
      {tasks.length === 0 && <p className="empty">لم تنشئ أي مهام بعد</p>}
      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <span className="task-bot">🤖 {task.bot_name}</span>
              <span className="badge">{STATUS_LABELS[task.status] || task.status}</span>
            </div>
            <div className="task-stats-row">
              <span>✅ مقبول: {task.accepted_count}</span>
              <span>⏳ معلق: {task.pending_count}</span>
              <span>👥 المطلوب: {task.required_count}</span>
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
            {task.task_type === 'paid' && (
              <div className="task-reward">
                💰 {task.reward_per_user} USDT × {task.required_count} =
                <strong> {(task.reward_per_user * task.required_count).toFixed(2)} USDT</strong>
              </div>
            )}
            <div className="task-meta">
              <span>📅 {new Date(task.created_at).toLocaleDateString('ar')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
