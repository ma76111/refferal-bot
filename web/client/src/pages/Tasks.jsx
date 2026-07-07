import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

const TYPE_LABELS = { paid: 'مدفوعة', exchange: 'تبادل' }
const PROOF_LABELS = { text: 'نص', images: 'صور', both: 'نص + صور' }

function SubmitModal({ task, onClose, onDone }) {
  const [proofText, setProofText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if ((task.proof_type === 'text' || task.proof_type === 'both') && !proofText.trim()) {
      setError('يجب إدخال نص الإثبات'); return
    }
    setLoading(true); setError('')
    try {
      await api.post(`/tasks/${task.id}/submit`, { proof_text: proofText })
      onDone()
    } catch (e) {
      setError(e.response?.data?.error || 'خطأ في التقديم')
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%' }}>
        <h3 style={{ marginBottom: '8px' }}>📝 تقديم إثبات</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: '16px' }}>🤖 {task.bot_name}</p>

        {task.verification_instructions && (
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px', marginBottom: '14px', fontSize: '.85rem' }}>
            📋 {task.verification_instructions}
          </div>
        )}

        <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '8px' }}>
          1. افتح الرابط وأكمل المهمة<br/>
          2. ارجع هنا وقدم إثباتك
        </p>

        <a href={task.referral_link} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', background: 'var(--accent)', color: '#fff', padding: '8px', borderRadius: '8px', marginBottom: '14px', textDecoration: 'none', fontSize: '.9rem' }}>
          🔗 فتح الرابط ↗
        </a>

        {(task.proof_type === 'text' || task.proof_type === 'both') && (
          <textarea value={proofText} onChange={e => setProofText(e.target.value)}
            placeholder="اكتب إثباتك هنا (اسم المستخدم، رابط، إلخ)..."
            rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box' }} />
        )}

        {task.proof_type === 'images' && (
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: '12px' }}>
            📸 يجب إرسال صورة الإثبات عبر البوت في تيليجرام
          </p>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '10px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={submit} disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent2)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {loading ? '⏳ جاري التقديم...' : '✅ تقديم الإثبات'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [submitted, setSubmitted] = useState(new Set())
  const [hidden, setHidden] = useState(new Set())
  const [toast, setToast] = useState('')

  const load = () => api.get('/tasks').then(r => setTasks(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const hide = async (taskId) => {
    await api.post(`/tasks/${taskId}/hide`)
    setHidden(p => new Set([...p, taskId]))
    showToast('✅ تم إخفاء المهمة')
  }

  const onSubmitDone = () => {
    setSubmitted(p => new Set([...p, selectedTask.id]))
    setSelectedTask(null)
    showToast('✅ تم تقديم الإثبات بنجاح! انتظر المراجعة')
    load()
  }

  const visibleTasks = tasks.filter(t => !hidden.has(t.id))

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', top: '70px', right: '20px', background: 'var(--accent2)', color: '#fff', padding: '10px 18px', borderRadius: '10px', zIndex: 200, fontSize: '.9rem' }}>
          {toast}
        </div>
      )}

      <h2>المهام المتاحة ({visibleTasks.length})</h2>
      {visibleTasks.length === 0 && <p className="empty">لا توجد مهام متاحة حالياً</p>}

      <div className="task-list">
        {visibleTasks.map(task => (
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
                <div className="progress-fill" style={{ width: `${Math.min((task.completed_count / task.required_count) * 100, 100)}%` }} />
              </div>
              <span>{task.completed_count}/{task.required_count}</span>
            </div>

            <div className="task-meta">
              <span>📸 {PROOF_LABELS[task.proof_type]}</span>
              {task.owner_rating_count > 0 && <span>⭐ {task.owner_rating}/5 ({task.owner_rating_count})</span>}
            </div>

            {task.verification_instructions && (
              <p className="task-instructions">{task.verification_instructions}</p>
            )}

            {!task.is_owner && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                {submitted.has(task.id) ? (
                  <span style={{ color: 'var(--accent2)', fontSize: '.85rem' }}>✅ تم التقديم - قيد المراجعة</span>
                ) : (
                  <button onClick={() => setSelectedTask(task)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    ⚡ تنفيذ المهمة
                  </button>
                )}
                <button onClick={() => hide(task.id)} title="إخفاء المهمة" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                  👁️
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedTask && (
        <SubmitModal task={selectedTask} onClose={() => setSelectedTask(null)} onDone={onSubmitDone} />
      )}
    </div>
  )
}
