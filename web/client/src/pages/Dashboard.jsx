import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

/** مخطط خطي بسيط باستخدام SVG */
function MiniLineChart({ data, width = 400, height = 80 }) {
  const points = useMemo(() => {
    if (!data || data.length < 2) return null
    const values = data.map(d => (d.deposit || 0) - (d.withdrawal || 0))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 20) + 10
      const y = height - 10 - (((d.deposit || 0) - (d.withdrawal || 0) - min) / range) * (height - 20)
      return { x, y, label: d.day, net: (d.deposit || 0) - (d.withdrawal || 0) }
    })
  }, [data, width, height])

  if (!points) return <p style={{ color: 'var(--muted)', fontSize: '.8rem', textAlign: 'center' }}>لا توجد بيانات كافية</p>

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* منطقة التعبئة */}
      <path d={`${pathD} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`}
        fill="url(#chartGrad)" />
      {/* الخط */}
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* النقاط */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
      ))}
    </svg>
  )
}

/** تعريف الودجات المتاحة */
const ALL_WIDGETS = [
  { id: 'balance',     icon: '💰', label: 'الرصيد',          key: 'balance' },
  { id: 'points',      icon: '🔄', label: 'نقاط التبادل',    key: 'exchange_points' },
  { id: 'active',      icon: '📋', label: 'مهام نشطة',       key: 'active_tasks' },
  { id: 'completed',   icon: '✅', label: 'تقديمات مقبولة',  key: 'completed_submissions' },
  { id: 'pending',     icon: '⏳', label: 'قيد المراجعة',    key: 'pending_submissions' },
  { id: 'deposited',   icon: '📥', label: 'إجمالي الإيداعات', key: 'total_deposited' },
]

const DEFAULT_VISIBLE = ['balance', 'points', 'active', 'completed']

function loadVisibleWidgets() {
  try {
    const saved = localStorage.getItem('dashboard_widgets')
    if (saved) return JSON.parse(saved)
  } catch (_) {}
  return DEFAULT_VISIBLE
}

/** رسم قيمة الودجة */
function widgetValue(id, user, stats) {
  switch (id) {
    case 'balance':   return `${parseFloat(user?.balance || 0).toFixed(2)} USDT`
    case 'points':    return user?.exchange_points || 0
    case 'active':    return stats?.active_tasks || 0
    case 'completed': return stats?.completed_submissions || 0
    case 'pending':   return stats?.pending_submissions || 0
    case 'deposited': return `${parseFloat(stats?.total_deposited || 0).toFixed(2)} USDT`
    default: return '—'
  }
}

/** أيقونات أنواع الأنشطة */
const ACTIVITY_ICONS = {
  login:        '🔑',
  task_created: '➕',
  task_updated: '✏️',
  submission:   '📝',
  deposit:      '💰',
  withdrawal:   '💸',
  ticket_reply: '💬',
  vote:         '⭐',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats]           = useState(null)
  const [copied, setCopied]         = useState(false)
  const [visible, setVisible]       = useState(loadVisibleWidgets)
  const [activity, setActivity]     = useState([])
  const [actPage, setActPage]       = useState(1)
  const [actTotal, setActTotal]     = useState(0)
  const [actFilter, setActFilter]   = useState('')
  const [actLoading, setActLoading] = useState(false)
  const [chartData, setChartData]   = useState([])

  useEffect(() => {
    api.get('/user/stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/user/balance-chart').then(r => setChartData(r.data || [])).catch(() => {})
  }, [])

  const loadActivity = useCallback(async () => {
    setActLoading(true)
    try {
      const params = new URLSearchParams({ page: actPage, pageSize: 10 })
      if (actFilter) params.set('eventType', actFilter)
      const r = await api.get(`/user/activity?${params}`)
      setActivity(r.data?.data || [])
      setActTotal(r.data?.total || 0)
    } catch (_) {}
    setActLoading(false)
  }, [actPage, actFilter])

  useEffect(() => { loadActivity() }, [loadActivity])

  function toggleWidget(id) {
    setVisible(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
      localStorage.setItem('dashboard_widgets', JSON.stringify(next))
      return next
    })
  }

  const copyId = () => {
    navigator.clipboard.writeText(String(user?.telegram_id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleString('ar', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function activityLabel(item) {
    const meta = (() => { try { return JSON.parse(item.metadata || '{}') } catch (_) { return {} } })()
    switch (item.event_type) {
      case 'login':        return 'تسجيل دخول'
      case 'task_created': return 'أنشأت مهمة جديدة'
      case 'task_updated': return 'عدّلت مهمة'
      case 'submission':   return 'قدّمت إثباتاً'
      case 'deposit':      return `إيداع ${meta.amount || ''} USDT`
      case 'withdrawal':   return `سحب ${meta.amount || ''} USDT`
      case 'ticket_reply': return 'رددت على تذكرة'
      default:             return item.event_type
    }
  }

  const totalPages = Math.ceil(actTotal / 10)

  return (
    <div className="page">
      <h2>مرحباً {user?.username ? `@${user.username}` : `#${user?.telegram_id}`} 👋</h2>

      {/* معرّف تيليجرام */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', width: 'fit-content' }}>
        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Telegram ID:</span>
        <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '.95rem' }}>{user?.telegram_id}</span>
        <button onClick={copyId} style={{ background: copied ? 'var(--accent2)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: copied ? '#fff' : 'var(--muted)', fontSize: '.78rem', transition: 'all .2s' }}>
          {copied ? '✓ تم النسخ' : 'نسخ'}
        </button>
      </div>

      {/* أزرار toggle الودجات */}
      <div className="widget-controls" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: '.8rem', color: 'var(--muted)', alignSelf: 'center' }}>الودجات:</span>
        {ALL_WIDGETS.map(w => (
          <button
            key={w.id}
            className={`widget-toggle${visible.includes(w.id) ? ' active' : ''}`}
            onClick={() => toggleWidget(w.id)}
            aria-pressed={visible.includes(w.id)}
          >
            {w.icon} {w.label}
          </button>
        ))}
      </div>

      {/* الودجات */}
      <div className="cards-grid" style={{ marginBottom: 28 }}>
        {ALL_WIDGETS.filter(w => visible.includes(w.id)).map(w => (
          <div key={w.id} className={`card${w.id === 'balance' ? ' accent' : ''}`}>
            <span className="card-icon">{w.icon}</span>
            <div>
              <div className="card-label">{w.label}</div>
              <div className="card-value">{widgetValue(w.id, user, stats)}</div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', gridColumn: '1/-1' }}>
            لا توجد ودجات مفعّلة. اضغط على إحداها أعلاه لإظهارها.
          </p>
        )}
      </div>

      {/* مخطط الرصيد */}
      {chartData.length > 1 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <h3 style={{ fontSize: '.9rem', marginBottom: 12, color: 'var(--muted)' }}>📈 حركة المحفظة (30 يوم)</h3>
          <MiniLineChart data={chartData} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '.75rem' }}>
            <span style={{ color: 'var(--accent2)' }}>▲ إيداع</span>
            <span style={{ color: 'var(--danger)' }}>▼ سحب</span>
          </div>
        </div>
      )}

      {/* سجل الأنشطة */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>📋 سجل الأنشطة</h3>
        <select
          value={actFilter}
          onChange={e => { setActFilter(e.target.value); setActPage(1) }}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '.8rem', cursor: 'pointer' }}
        >
          <option value="">كل الأنشطة</option>
          <option value="login">تسجيل الدخول</option>
          <option value="task_created">إنشاء مهمة</option>
          <option value="submission">تقديم</option>
          <option value="deposit">إيداع</option>
          <option value="withdrawal">سحب</option>
          <option value="ticket_reply">دعم</option>
        </select>
      </div>

      {actLoading ? (
        <div className="spinner" style={{ margin: '20px auto' }} />
      ) : activity.length === 0 ? (
        <p className="empty">لا توجد أنشطة بعد</p>
      ) : (
        <div className="activity-list">
          {activity.map(item => (
            <div key={item.id} className="activity-item">
              <span className="activity-icon">{ACTIVITY_ICONS[item.event_type] || '📌'}</span>
              <span className="activity-text">{activityLabel(item)}</span>
              <span className="activity-time">{formatTime(item.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* pagination للأنشطة */}
      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: 12 }}>
          <button className="pagination-btn" onClick={() => setActPage(1)} disabled={actPage === 1}>«</button>
          <button className="pagination-btn" onClick={() => setActPage(p => Math.max(1, p - 1))} disabled={actPage === 1}>‹</button>
          <span className="pagination-info">{actPage} / {totalPages}</span>
          <button className="pagination-btn" onClick={() => setActPage(p => Math.min(totalPages, p + 1))} disabled={actPage === totalPages}>›</button>
          <button className="pagination-btn" onClick={() => setActPage(totalPages)} disabled={actPage === totalPages}>»</button>
        </div>
      )}
    </div>
  )
}
