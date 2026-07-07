import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

const STATUS_LABELS = {
  active:    '🟢 نشطة',
  paused:    '⏸️ متوقفة',
  completed: '✅ مكتملة',
  cancelled: '❌ ملغية'
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--surface2)',
  color: 'var(--text)', marginBottom: '12px', boxSizing: 'border-box', fontSize: '.9rem'
}
const btnPrimary = {
  width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
  background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.9rem'
}

function AddTaskModal({ onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1) // 1=نوع المهمة, 2=تفاصيل
  const [form, setForm] = useState({
    task_type: '', bot_name: '', referral_link: '',
    required_count: '', reward_per_user: '0',
    proof_type: 'text', verification_instructions: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({})

  useEffect(() => {
    api.get('/user/settings').then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/tasks/create', form)
      onDone()
    } catch (e) {
      setError(e.response?.data?.error || 'خطأ في إنشاء المهمة')
    }
    setLoading(false)
  }

  const exchangeCost = (parseInt(settings.exchange_points_cost) || 3) * (parseInt(form.required_count) || 0)
  const paidCost = (parseFloat(form.reward_per_user) || 0) * (parseInt(form.required_count) || 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '16px' }}>➕ إضافة مهمة جديدة</h3>

        {/* اختيار نوع المهمة */}
        {step === 1 && (
          <>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: '16px' }}>اختر نوع المهمة:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => { set('task_type', 'exchange'); setStep(2) }} style={{ padding: '14px', borderRadius: '10px', border: '2px solid var(--accent)', background: 'rgba(108,99,255,.1)', color: 'var(--text)', cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>🔄 تبادل إحالات</div>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: '4px' }}>
                  تكلفة: {exchangeCost > 0 ? `${exchangeCost} نقطة` : `${settings.exchange_points_cost || 3} نقطة × عدد الأشخاص`}
                  <br/>رصيدك: {user?.exchange_points || 0} نقطة
                </div>
              </button>
              <button onClick={() => { set('task_type', 'paid'); setStep(2) }} style={{ padding: '14px', borderRadius: '10px', border: '2px solid var(--accent2)', background: 'rgba(74,222,128,.1)', color: 'var(--text)', cursor: 'pointer', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>💵 مهمة مدفوعة</div>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: '4px' }}>
                  تدفع لكل منفذ مبلغاً من رصيدك
                  <br/>رصيدك: {parseFloat(user?.balance || 0).toFixed(2)} USDT
                </div>
              </button>
            </div>
            <button onClick={onClose} style={{ marginTop: '12px', width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>إلغاء</button>
          </>
        )}

        {/* تفاصيل المهمة */}
        {step === 2 && (
          <>
            <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', fontSize: '.82rem', color: 'var(--accent)' }}>
              {form.task_type === 'exchange' ? '🔄 تبادل إحالات' : '💵 مهمة مدفوعة'}
            </div>

            <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>🤖 اسم البوت</label>
            <input style={inputStyle} placeholder="@mybotname" value={form.bot_name}
              onChange={e => set('bot_name', e.target.value)} />

            <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>🔗 رابط الإحالة</label>
            <input style={inputStyle} placeholder="https://t.me/mybot?start=ref123" value={form.referral_link}
              onChange={e => set('referral_link', e.target.value)} />

            <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>👥 عدد الأشخاص المطلوبين</label>
            <input style={inputStyle} type="number" placeholder="10" value={form.required_count}
              onChange={e => set('required_count', e.target.value)} />

            {form.task_type === 'paid' && (
              <>
                <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>💰 المكافأة لكل شخص (USDT)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0.05" value={form.reward_per_user}
                  onChange={e => set('reward_per_user', e.target.value)} />
                {form.required_count && form.reward_per_user && (
                  <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid var(--accent2)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '.85rem' }}>
                    💰 الإجمالي: <strong>{paidCost.toFixed(2)} USDT</strong>
                  </div>
                )}
              </>
            )}

            {form.task_type === 'exchange' && form.required_count && (
              <div style={{ background: 'rgba(108,99,255,.1)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '.85rem' }}>
                🔄 التكلفة: <strong>{exchangeCost} نقطة مقايضة</strong>
              </div>
            )}

            <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>📸 نوع الإثبات</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.proof_type}
              onChange={e => set('proof_type', e.target.value)}>
              <option value="text">📝 نص فقط</option>
              <option value="images">🖼 صور فقط</option>
              <option value="both">📝🖼 نص + صور</option>
            </select>

            <label style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>📋 تعليمات الإثبات (اختياري)</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
              placeholder="مثال: أرسل اسم المستخدم بعد الاشتراك..."
              value={form.verification_instructions}
              onChange={e => set('verification_instructions', e.target.value)} />

            {error && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '10px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setStep(1); setError('') }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                ← رجوع
              </button>
              <button style={{ ...btnPrimary, flex: 1 }} onClick={submit} disabled={loading}>
                {loading ? '⏳ جاري الإنشاء...' : '✅ إنشاء المهمة'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MyTasks() {
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [toast, setToast]       = useState('')
  const [auditModal, setAuditModal] = useState(null) // task id للمهمة التي نعرض سجلها
  const [auditData, setAuditData]   = useState([])

  const load = useCallback(() =>
    api.get('/tasks/mine').then(r => setTasks(r.data)).finally(() => setLoading(false))
  , [])

  useEffect(() => { load() }, [load])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handlePause(taskId) {
    try {
      await api.post(`/tasks/${taskId}/pause`)
      showToast('⏸️ تم إيقاف المهمة مؤقتاً')
      load()
    } catch (e) { showToast(e.response?.data?.error || 'فشل الإيقاف') }
  }

  async function handleResume(taskId) {
    try {
      await api.post(`/tasks/${taskId}/resume`)
      showToast('▶️ تم استئناف المهمة')
      load()
    } catch (e) { showToast(e.response?.data?.error || 'فشل الاستئناف') }
  }

  async function showAudit(taskId) {
    setAuditModal(taskId)
    try {
      const r = await api.get(`/tasks/${taskId}/audit`)
      setAuditData(r.data || [])
    } catch (_) { setAuditData([]) }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', top: '70px', right: '20px', background: 'var(--accent2)', color: '#fff', padding: '10px 18px', borderRadius: '10px', zIndex: 200, fontSize: '.9rem' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>مهامي ({tasks.length})</h2>
        <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.9rem' }}>
          ➕ إضافة مهمة
        </button>
      </div>

      {tasks.length === 0 && <p className="empty">لم تنشئ أي مهام بعد</p>}

      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <span className="task-bot">🤖 {task.bot_name}</span>
              <span className={`badge ${task.task_type}`}>{task.task_type === 'paid' ? 'مدفوعة' : 'تبادل'}</span>
              <span className="badge">{STATUS_LABELS[task.status] || task.status}</span>
            </div>
            <div className="task-stats-row">
              <span>✅ مقبول: {task.accepted_count}</span>
              <span>⏳ معلق: {task.pending_count}</span>
              <span>👥 المطلوب: {task.required_count}</span>
            </div>
            <div className="task-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min((task.completed_count / task.required_count) * 100, 100)}%` }} />
              </div>
              <span>{task.completed_count}/{task.required_count}</span>
            </div>
            {task.task_type === 'paid' && (
              <div className="task-reward">
                💰 {task.reward_per_user} USDT × {task.required_count} = <strong>{(task.reward_per_user * task.required_count).toFixed(2)} USDT</strong>
              </div>
            )}
            <div className="task-meta">
              <span>📅 {new Date(task.created_at).toLocaleDateString('ar')}</span>
            </div>
            {/* أزرار الإجراءات */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {task.status === 'active' && (
                <button
                  onClick={() => handlePause(task.id)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem' }}
                >
                  ⏸️ إيقاف مؤقت
                </button>
              )}
              {task.status === 'paused' && (
                <button
                  onClick={() => handleResume(task.id)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--accent2)', background: 'rgba(74,222,128,.1)', color: 'var(--accent2)', cursor: 'pointer', fontSize: '.8rem' }}
                >
                  ▶️ استئناف
                </button>
              )}
              <button
                onClick={() => showAudit(task.id)}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem' }}
              >
                📋 سجل التعديلات
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddTaskModal
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); showToast('✅ تم إنشاء المهمة بنجاح!'); load() }}
        />
      )}

      {/* Modal سجل التعديلات */}
      {auditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3>📋 سجل التعديلات</h3>
              <button onClick={() => setAuditModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            {auditData.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center' }}>لا توجد تعديلات بعد</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {auditData.map(entry => (
                  <div key={entry.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{entry.field_name}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>{new Date(entry.created_at).toLocaleString('ar')}</span>
                    </div>
                    <div style={{ color: 'var(--muted)' }}>
                      <span style={{ color: 'var(--danger)' }}>{entry.old_value || '—'}</span>
                      {' → '}
                      <span style={{ color: 'var(--accent2)' }}>{entry.new_value || '—'}</span>
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4 }}>بواسطة: {entry.changed_by_username || entry.changed_by}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
