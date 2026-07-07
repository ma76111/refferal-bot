import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const TABS = ['📊 إحصائيات','💵 إيداعات','💸 سحوبات','✅ إثباتات','📋 استئنافات','🚫 محظورون','⚙️ إعدادات','🔍 مستخدم','🎫 تذاكر']

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="card" style={{ borderColor: accent ? 'var(--accent)' : undefined }}>
      <span className="card-icon">{icon}</span>
      <div><div className="card-label">{label}</div><div className="card-value">{value}</div></div>
    </div>
  )
}

function ConfirmBtn({ label, onClick, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: danger ? 'var(--danger)' : 'var(--accent)', color: '#fff', fontSize: '.8rem', opacity: disabled ? .5 : 1
    }}>{label}</button>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [stats, setStats] = useState(null)
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [appeals, setAppeals] = useState([])
  const [bans, setBans] = useState([])
  const [settings, setSettings] = useState({})
  const [adminTickets, setAdminTickets] = useState([])
  const [ticketFilter, setTicketFilter] = useState('')
  const [ticketReply, setTicketReply] = useState({})
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [editSetting, setEditSetting] = useState({})

  useEffect(() => {
    if (!user?.is_admin) { navigate('/'); return }
  }, [user])

  useEffect(() => {
    if (!user?.is_admin) return
    if (tab === 0) api.get('/admin/stats').then(r => setStats(r.data))
    if (tab === 1) api.get('/admin/deposits').then(r => setDeposits(r.data))
    if (tab === 2) api.get('/admin/withdrawals').then(r => setWithdrawals(r.data))
    if (tab === 3) api.get('/admin/submissions').then(r => setSubmissions(r.data))
    if (tab === 4) api.get('/admin/appeals').then(r => setAppeals(r.data))
    if (tab === 5) api.get('/admin/bans').then(r => setBans(r.data))
    if (tab === 6) api.get('/admin/settings').then(r => { setSettings(r.data); setEditSetting(r.data) })
    if (tab === 8) api.get('/tickets/admin/all').then(r => setAdminTickets(r.data))
  }, [tab, user])

  const action = async (url, method = 'post', body = {}) => {
    setLoading(true)
    try { await api[method](url, body) } catch(e) { alert(e.response?.data?.error || 'خطأ') }
    setLoading(false)
    // refresh
    if (tab === 1) api.get('/admin/deposits').then(r => setDeposits(r.data))
    if (tab === 2) api.get('/admin/withdrawals').then(r => setWithdrawals(r.data))
    if (tab === 3) api.get('/admin/submissions').then(r => setSubmissions(r.data))
    if (tab === 4) api.get('/admin/appeals').then(r => setAppeals(r.data))
    if (tab === 5) api.get('/admin/bans').then(r => setBans(r.data))
    if (tab === 0) api.get('/admin/stats').then(r => setStats(r.data))
    if (tab === 8) api.get('/tickets/admin/all').then(r => setAdminTickets(r.data))
  }

  const search = async () => {
    if (!searchQ) return
    const r = await api.get(`/admin/users/search?q=${encodeURIComponent(searchQ)}`)
    setSearchResults(r.data)
  }

  const row = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '8px', flexWrap: 'wrap' }
  const info = { flex: 1, fontSize: '.85rem' }
  const muted = { color: 'var(--muted)', fontSize: '.75rem' }

  if (!user?.is_admin) return null

  return (
    <div className="page">
      <h2>⚙️ لوحة التحكم</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)',
            background: tab === i ? 'var(--accent)' : 'var(--surface)', color: tab === i ? '#fff' : 'var(--text)',
            cursor: 'pointer', fontSize: '.82rem'
          }}>{t}</button>
        ))}
      </div>

      {/* ── إحصائيات ── */}
      {tab === 0 && stats && (
        <div className="cards-grid">
          <StatCard icon="👥" label="المستخدمون" value={stats.total_users} accent />
          <StatCard icon="🚫" label="محظورون" value={stats.banned_users} />
          <StatCard icon="📋" label="مهام نشطة" value={stats.active_tasks} />
          <StatCard icon="⏳" label="إثباتات معلقة" value={stats.pending_submissions} />
          <StatCard icon="💵" label="إيداعات معلقة" value={stats.pending_deposits} />
          <StatCard icon="💸" label="سحوبات معلقة" value={stats.pending_withdrawals} />
          <StatCard icon="🚨" label="إبلاغات معلقة" value={stats.pending_reports} />
          <StatCard icon="📝" label="استئنافات معلقة" value={stats.pending_appeals} />
          <StatCard icon="💰" label="إجمالي الأرصدة" value={`${parseFloat(stats.total_balance||0).toFixed(2)} USDT`} accent />
        </div>
      )}

      {/* ── إيداعات ── */}
      {tab === 1 && (
        deposits.length === 0 ? <p style={muted}>لا توجد إيداعات معلقة ✅</p> :
        deposits.map(d => (
          <div key={d.id} style={row}>
            <div style={info}>
              <strong>{d.username || d.telegram_id}</strong> <span style={muted}>#{d.id}</span><br/>
              <span style={muted}>{d.amount} USDT • {d.method} • {new Date(d.created_at).toLocaleDateString('ar')}</span>
              {d.binance_id && <><br/><span style={muted}>Binance ID: {d.binance_id}</span></>}
            </div>
            <ConfirmBtn label="✅ قبول" onClick={() => action(`/admin/deposits/${d.id}/accept`)} disabled={loading} />
            <ConfirmBtn label="❌ رفض" danger onClick={() => action(`/admin/deposits/${d.id}/reject`, 'post', { reason: 'رفض الأدمن' })} disabled={loading} />
          </div>
        ))
      )}

      {/* ── سحوبات ── */}
      {tab === 2 && (
        withdrawals.length === 0 ? <p style={muted}>لا توجد سحوبات معلقة ✅</p> :
        withdrawals.map(w => (
          <div key={w.id} style={row}>
            <div style={info}>
              <strong>{w.username || w.telegram_id}</strong> <span style={muted}>#{w.id}</span><br/>
              <span style={muted}>{w.amount} USDT • {w.method}</span>
              {w.binance_id && <><br/><span style={muted}>ID: {w.binance_id}</span></>}
              {w.wallet_address && <><br/><span style={muted}>Wallet: {w.wallet_address}</span></>}
            </div>
            <ConfirmBtn label="✅ تم" onClick={() => action(`/admin/withdrawals/${w.id}/complete`)} disabled={loading} />
            <ConfirmBtn label="❌ رفض" danger onClick={() => action(`/admin/withdrawals/${w.id}/reject`, 'post', { reason: 'رفض الأدمن' })} disabled={loading} />
          </div>
        ))
      )}

      {/* ── إثباتات ── */}
      {tab === 3 && (
        submissions.length === 0 ? <p style={muted}>لا توجد إثباتات معلقة ✅</p> :
        submissions.map(s => (
          <div key={s.id} style={row}>
            <div style={info}>
              <strong>{s.submitter_username || s.submitter_id}</strong> → <span style={muted}>{s.bot_name}</span><br/>
              <span style={muted}>{s.task_type === 'paid' ? `💰 ${s.reward_per_user} USDT` : '🔄 تبادل'} • {new Date(s.created_at).toLocaleDateString('ar')}</span>
              {s.proof_text && <><br/><span style={{ fontSize: '.8rem' }}>📝 {s.proof_text.slice(0, 100)}</span></>}
            </div>
            <ConfirmBtn label="✅ قبول" onClick={() => action(`/admin/submissions/${s.id}/accept`)} disabled={loading} />
            <ConfirmBtn label="❌ رفض" danger onClick={() => action(`/admin/submissions/${s.id}/reject`, 'post', { reason: 'رفض' })} disabled={loading} />
          </div>
        ))
      )}

      {/* ── استئنافات ── */}
      {tab === 4 && (
        appeals.length === 0 ? <p style={muted}>لا توجد استئنافات معلقة ✅</p> :
        appeals.map(a => (
          <div key={a.id} style={row}>
            <div style={info}>
              <strong>{a.username || a.telegram_id}</strong><br/>
              <span style={muted}>سبب الحظر: {a.ban_reason || '-'}</span><br/>
              <span style={{ fontSize: '.8rem' }}>📝 {a.reason}</span>
            </div>
            <ConfirmBtn label="✅ قبول" onClick={() => action(`/admin/appeals/${a.id}/approve`)} disabled={loading} />
            <ConfirmBtn label="❌ رفض" danger onClick={() => action(`/admin/appeals/${a.id}/reject`)} disabled={loading} />
          </div>
        ))
      )}

      {/* ── محظورون ── */}
      {tab === 5 && (
        bans.length === 0 ? <p style={muted}>لا يوجد محظورون ✅</p> :
        bans.map(b => (
          <div key={b.id} style={row}>
            <div style={info}>
              <strong>{b.username || b.telegram_id}</strong> <span style={muted}>({b.type === 'permanent' ? '🔴 دائم' : '⏳ مؤقت'})</span><br/>
              <span style={muted}>{b.reason || 'بدون سبب'}</span>
              {b.end_date && <><br/><span style={muted}>ينتهي: {new Date(b.end_date).toLocaleDateString('ar')}</span></>}
            </div>
            <ConfirmBtn label="رفع الحظر" onClick={() => action(`/admin/users/${b.user_id}/unban`)} disabled={loading} />
          </div>
        ))
      )}

      {/* ── إعدادات ── */}
      {tab === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
          {[
            { key: 'max_required_count', label: '🔧 الحد الأقصى للأشخاص' },
            { key: 'max_tasks_per_user', label: '📝 حد المهام للمستخدم' },
            { key: 'task_timeout', label: '⏱️ وقت المهلة (ثانية)' },
            { key: 'improvement_timeout', label: '🔄 مهلة التحسين (ثانية)' },
            { key: 'min_reward', label: '💰 حد أدنى مكافأة (تيليجرام)' },
            { key: 'min_external_reward', label: '🌐 حد أدنى مكافأة (خارجي)' },
            { key: 'exchange_points_cost', label: '🔄 تكلفة نقاط المقايضة' },
            { key: 'min_withdrawal', label: '💸 الحد الأدنى للسحب' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
              <label style={{ flex: 1, fontSize: '.85rem' }}>{label}</label>
              <input value={editSetting[key] || ''} onChange={e => setEditSetting(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', textAlign: 'center' }} />
              <ConfirmBtn label="حفظ" onClick={() => action('/admin/settings', 'post', { key, value: editSetting[key] })} disabled={loading} />
            </div>
          ))}
        </div>
      )}

      {/* ── بحث عن مستخدم ── */}
      {tab === 7 && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="ادخل ID أو يوزرنيم..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
            <ConfirmBtn label="بحث" onClick={search} />
          </div>
          {searchResults.map(u => (
            <UserCard key={u.id} user={u} action={action} loading={loading} />
          ))}
        </div>
      )}

      {/* ── تذاكر الدعم ── */}
      {tab === 8 && (
        <div>
          {/* فلترة */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['', 'open', 'in_progress', 'closed'].map(s => (
              <button key={s} onClick={() => setTicketFilter(s)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.8rem', cursor: 'pointer',
                  border: `1px solid ${ticketFilter === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: ticketFilter === s ? 'var(--accent)' : 'none',
                  color: ticketFilter === s ? '#fff' : 'var(--muted)'
                }}>
                {s === '' ? 'الكل' : s === 'open' ? 'مفتوحة' : s === 'in_progress' ? 'جارية' : 'مغلقة'}
              </button>
            ))}
            <button onClick={() => api.get('/tickets/admin/all').then(r => setAdminTickets(r.data))}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: '.8rem', cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)' }}>
              🔄 تحديث
            </button>
          </div>

          {adminTickets
            .filter(t => !ticketFilter || t.status === ticketFilter)
            .map(ticket => (
              <div key={ticket.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{ticket.subject}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '.75rem', marginInlineStart: 8 }}>{ticket.ticket_no}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{ticket.user_username || ticket.user_id}</span>
                    <span className={`badge priority-${ticket.priority}`}>{ticket.priority}</span>
                    <span className={`badge ${ticket.status === 'closed' ? 'rejected' : 'pending'}`}>
                      {ticket.status === 'open' ? 'مفتوحة' : ticket.status === 'in_progress' ? 'جارية' : 'مغلقة'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ticket.status !== 'closed' && (
                    <button onClick={() => action(`/tickets/admin/${ticket.id}/status`, 'put', { status: 'closed' })}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--muted)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>
                      🔒 إغلاق
                    </button>
                  )}
                  {ticket.status === 'open' && (
                    <button onClick={() => action(`/tickets/admin/${ticket.id}/assign`, 'put', { admin_id: null })}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>
                      📌 تعيين لي
                    </button>
                  )}
                </div>

                {/* نموذج الرد */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    value={ticketReply[ticket.id] || ''}
                    onChange={e => setTicketReply(p => ({ ...p, [ticket.id]: e.target.value }))}
                    placeholder="اكتب رداً..."
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '.85rem' }}
                  />
                  <button
                    disabled={!ticketReply[ticket.id]?.trim() || loading}
                    onClick={async () => {
                      if (!ticketReply[ticket.id]?.trim()) return
                      await action(`/tickets/admin/${ticket.id}/reply`, 'post', { body: ticketReply[ticket.id] })
                      setTicketReply(p => ({ ...p, [ticket.id]: '' }))
                      api.get('/tickets/admin/all').then(r => setAdminTickets(r.data))
                    }}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '.82rem' }}
                  >
                    إرسال
                  </button>
                </div>
              </div>
            ))}
          {adminTickets.filter(t => !ticketFilter || t.status === ticketFilter).length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>لا توجد تذاكر</p>
          )}
        </div>
      )}
    </div>
  )
}

function UserCard({ user: u, action, loading }) {
  const [balance, setBalance] = useState(u.balance)
  const [points, setPoints] = useState(u.exchange_points)
  const [banDays, setBanDays] = useState('')
  const muted = { color: 'var(--muted)', fontSize: '.75rem' }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ marginBottom: '12px' }}>
        <strong>{u.username ? `@${u.username}` : u.telegram_id}</strong>
        <span style={{ ...muted, marginRight: '8px' }}>ID: {u.telegram_id}</span>
        <span style={{ ...muted, marginRight: '8px', color: u.is_banned ? 'var(--danger)' : 'var(--accent2)' }}>
          {u.is_banned ? '🔴 محظور' : '🟢 نشط'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={muted}>💰 رصيد:</span>
          <input value={balance} onChange={e => setBalance(e.target.value)} style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
          <button onClick={() => action(`/admin/users/${u.id}/balance`, 'post', { amount: balance })} disabled={loading}
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>حفظ</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={muted}>🔄 نقاط:</span>
          <input value={points} onChange={e => setPoints(e.target.value)} style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
          <button onClick={() => action(`/admin/users/${u.id}/points`, 'post', { points })} disabled={loading}
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>حفظ</button>
        </div>
        {!u.is_banned ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input value={banDays} onChange={e => setBanDays(e.target.value)} placeholder="أيام (0=دائم)"
              style={{ width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
            <button onClick={() => action(`/admin/users/${u.id}/ban`, 'post', { reason: 'قرار أدمن', duration: banDays || null })} disabled={loading}
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>🚫 حظر</button>
          </div>
        ) : (
          <button onClick={() => action(`/admin/users/${u.id}/unban`)} disabled={loading}
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent2)', color: '#fff', cursor: 'pointer', fontSize: '.78rem' }}>✅ رفع حظر</button>
        )}
      </div>
    </div>
  )
}
