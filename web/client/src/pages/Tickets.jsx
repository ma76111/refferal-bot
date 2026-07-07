import { useState, useEffect, useCallback } from 'react'
import api from '../api'

const PRIORITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' }
const STATUS_LABELS   = { open: 'مفتوحة', in_progress: 'جاري المعالجة', closed: 'مغلقة' }

export default function Tickets() {
  const [tickets, setTickets]         = useState([])
  const [selected, setSelected]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showNew, setShowNew]         = useState(false)
  const [replyText, setReplyText]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [newForm, setNewForm]         = useState({ subject: '', priority: 'medium', message: '' })
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/tickets')
      setTickets(r.data || [])
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  async function openTicket(ticket) {
    setSelected(ticket)
    setReplyText('')
    try {
      const r = await api.get(`/tickets/${ticket.id}`)
      setMessages(r.data?.messages || [])
    } catch (_) { setMessages([]) }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/tickets/${selected.id}/reply`, { body: replyText.trim() })
      setReplyText('')
      const r = await api.get(`/tickets/${selected.id}`)
      setMessages(r.data?.messages || [])
      setSuccess('تم إرسال ردك')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'فشل الإرسال')
    }
    setSubmitting(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newForm.subject.trim() || !newForm.message.trim()) {
      return setError('الموضوع والرسالة مطلوبان')
    }
    setSubmitting(true)
    setError('')
    try {
      const r = await api.post('/tickets', {
        subject: newForm.subject.trim(),
        priority: newForm.priority,
      })
      // إرسال الرسالة الأولى
      await api.post(`/tickets/${r.data.id}/reply`, { body: newForm.message.trim() })
      setSuccess(`تم إنشاء تذكرتك رقم ${r.data.ticket_no}`)
      setShowNew(false)
      setNewForm({ subject: '', priority: 'medium', message: '' })
      loadTickets()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.response?.data?.error || 'فشل الإنشاء')
    }
    setSubmitting(false)
  }

  if (loading) return <div className="page"><div className="spinner" style={{ margin: '40px auto' }} /></div>

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>🎫 تذاكر الدعم</h2>
        <button
          className="btn-primary"
          onClick={() => { setShowNew(true); setSelected(null); setError('') }}
          style={{ marginTop: 0 }}
        >
          + تذكرة جديدة
        </button>
      </div>

      {success && <div style={{ padding: '10px 14px', background: '#14532d', color: '#86efac', borderRadius: 8, marginBottom: 12, fontSize: '.875rem' }}>{success}</div>}
      {error   && <div style={{ padding: '10px 14px', background: '#450a0a', color: '#fca5a5', borderRadius: 8, marginBottom: 12, fontSize: '.875rem' }}>{error}</div>}

      {/* نموذج تذكرة جديدة */}
      {showNew && (
        <form onSubmit={handleCreate} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>تذكرة جديدة</h3>
          <div className="form-group">
            <label className="form-label">الموضوع</label>
            <input
              className="form-input"
              value={newForm.subject}
              onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="وصف موجز للمشكلة"
              maxLength={200}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">الأولوية</label>
            <select
              className="form-select"
              value={newForm.priority}
              onChange={e => setNewForm(f => ({ ...f, priority: e.target.value }))}
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">الرسالة</label>
            <textarea
              className="form-textarea"
              value={newForm.message}
              onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))}
              placeholder="اشرح مشكلتك بالتفصيل..."
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: 0 }}>
              {submitting ? '...' : 'إرسال'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setError('') }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '300px 1fr' : '1fr', gap: 16 }}>
        {/* قائمة التذاكر */}
        <div className="ticket-list">
          {tickets.length === 0 && !showNew ? (
            <div className="empty">لا توجد تذاكر بعد</div>
          ) : (
            tickets.map(ticket => (
              <div
                key={ticket.id}
                className={`ticket-card ${ticket.status}${selected?.id === ticket.id ? ' active' : ''}`}
                onClick={() => openTicket(ticket)}
                style={{ borderColor: selected?.id === ticket.id ? 'var(--accent)' : undefined }}
              >
                <div className="ticket-header">
                  <span className="ticket-no">{ticket.ticket_no}</span>
                  <span className={`badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                </div>
                <div className="ticket-subject">{ticket.subject}</div>
                <div className="ticket-meta">
                  <span className={`badge ${ticket.status === 'closed' ? 'rejected' : ticket.status === 'in_progress' ? 'pending' : 'accept'}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                  <span>{ticket.message_count || 0} رسائل</span>
                  <span>{new Date(ticket.created_at).toLocaleDateString('ar')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* تفاصيل التذكرة */}
        {selected && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{selected.subject}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{selected.ticket_no}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>

            {/* الرسائل */}
            <div className="ticket-messages" style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.is_admin ? 'flex-end' : 'flex-start' }}>
                  <div className={`message-bubble ${msg.is_admin ? 'message-admin' : 'message-user'}`}>
                    {!msg.is_admin && <div style={{ fontSize: '.72rem', marginBottom: 4, color: 'var(--muted)' }}>{msg.sender_username || 'المستخدم'}</div>}
                    <div>{msg.body}</div>
                    <div className="message-time">{new Date(msg.created_at).toLocaleString('ar')}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* نموذج الرد */}
            {selected.status !== 'closed' && (
              <form onSubmit={handleReply} style={{ display: 'flex', gap: 8 }}>
                <textarea
                  className="form-textarea"
                  style={{ flex: 1, minHeight: 60, resize: 'none' }}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="اكتب ردك..."
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !replyText.trim()}
                  style={{ marginTop: 0, alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                >
                  إرسال
                </button>
              </form>
            )}
            {selected.status === 'closed' && (
              <div style={{ padding: '10px', background: 'var(--surface2)', borderRadius: 8, textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
                هذه التذكرة مغلقة
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
