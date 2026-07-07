import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

const DEP_STATUS  = { pending: 'قيد المراجعة ⏳', accept: 'مقبول ✅', reject: 'مرفوض ❌' }
const WITH_STATUS = { pending: 'قيد المراجعة ⏳', completed: 'مكتمل ✅', rejected: 'مرفوض ❌' }

const METHOD_LABELS = {
  binance: 'Binance Pay ID',
  trc20:   'USDT-TRC20',
  ton:     'TON Wallet',
}

const METHOD_PLACEHOLDERS = {
  binance: 'أدخل Binance Pay ID (9-12 رقم)',
  trc20:   'أدخل عنوان TRC20 (يبدأ بـ T)',
  ton:     'أدخل عنوان TON (يبدأ بـ UQ أو EQ)',
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }}>
        <h3 style={{ marginBottom: 16 }}>{title}</h3>
        {children}
        <button onClick={onClose} style={{ marginTop: 10, width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
          إلغاء
        </button>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box', fontSize: '.9rem' }
const btnPrimary = { width: '100%', padding: 10, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.9rem' }

export default function Wallet() {
  const { user, setUser } = useAuth()
  const [deposits, setDeposits]       = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [tab, setTab]                 = useState('deposits')
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [toast, setToast]             = useState('')
  const [error, setError]             = useState('')

  // نماذج الإيداع والسحب مع دعم الطرق الثلاث
  const [depForm, setDepForm]   = useState({ amount: '', method: 'binance', address: '' })
  const [withForm, setWithForm] = useState({ amount: '', method: 'binance', address: '' })

  const load = () => {
    api.get('/wallet/deposits').then(r => setDeposits(r.data))
    api.get('/wallet/withdrawals').then(r => setWithdrawals(r.data))
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // بناء payload الإيداع حسب الطريقة
  function buildDepositPayload() {
    const { amount, method, address } = depForm
    const base = { amount, method }
    if (method === 'binance') return { ...base, binance_id: address }
    return { ...base, wallet_address: address }
  }

  // بناء payload السحب حسب الطريقة
  function buildWithdrawPayload() {
    const { amount, method, address } = withForm
    const base = { amount, method }
    if (method === 'binance') return { ...base, binance_id: address }
    if (method === 'ton')     return { ...base, ton_address: address }
    return { ...base, wallet_address: address }
  }

  const submitDeposit = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/wallet/deposit', buildDepositPayload())
      setShowDeposit(false)
      setDepForm({ amount: '', method: 'binance', address: '' })
      showToast('✅ تم إرسال طلب الإيداع بنجاح')
      load()
    } catch (e) { setError(e.response?.data?.error || 'حدث خطأ') }
    setLoading(false)
  }

  const submitWithdraw = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/wallet/withdraw', buildWithdrawPayload())
      setShowWithdraw(false)
      setWithForm({ amount: '', method: 'binance', address: '' })
      const r = await api.get('/user/me')
      setUser(r.data)
      showToast('✅ تم إرسال طلب السحب بنجاح')
      load()
    } catch (e) { setError(e.response?.data?.error || 'حدث خطأ') }
    setLoading(false)
  }

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', top: 70, right: 20, background: 'var(--accent2)', color: '#fff', padding: '10px 18px', borderRadius: 10, zIndex: 200, fontSize: '.9rem' }}>
          {toast}
        </div>
      )}

      <h2>المحفظة</h2>
      <div className="balance-banner">
        <span>💰 الرصيد الحالي</span>
        <strong>{parseFloat(user?.balance || 0).toFixed(2)} USDT</strong>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => { setError(''); setShowDeposit(true) }}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--accent2)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
          💳 إيداع USDT
        </button>
        <button onClick={() => { setError(''); setShowWithdraw(true) }}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: '2px solid var(--accent)', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>
          💸 سحب USDT
        </button>
      </div>

      <div className="tabs">
        <button className={tab === 'deposits' ? 'active' : ''} onClick={() => setTab('deposits')}>
          الإيداعات ({deposits.length})
        </button>
        <button className={tab === 'withdrawals' ? 'active' : ''} onClick={() => setTab('withdrawals')}>
          السحوبات ({withdrawals.length})
        </button>
      </div>

      {tab === 'deposits' && (
        <div className="tx-list">
          {deposits.length === 0 && <p className="empty">لا توجد إيداعات</p>}
          {deposits.map(d => (
            <div key={d.id} className="tx-row">
              <span className="tx-amount">+{d.amount} USDT</span>
              <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{METHOD_LABELS[d.method] || d.method}</span>
              <span className={`badge ${d.status}`}>{DEP_STATUS[d.status] || d.status}</span>
              <span className="tx-date">{new Date(d.created_at).toLocaleDateString('ar')}</span>
              {d.status === 'reject' && d.reject_reason && (
                <span style={{ fontSize: '.75rem', color: 'var(--danger)', width: '100%', marginTop: 4 }}>
                  ✗ {d.reject_reason}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className="tx-list">
          {withdrawals.length === 0 && <p className="empty">لا توجد سحوبات</p>}
          {withdrawals.map(w => (
            <div key={w.id} className="tx-row">
              <span className="tx-amount tx-out">-{w.amount} USDT</span>
              <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{METHOD_LABELS[w.method] || w.method}</span>
              <span className={`badge ${w.status}`}>{WITH_STATUS[w.status] || w.status}</span>
              <span className="tx-date">{new Date(w.created_at).toLocaleDateString('ar')}</span>
              {w.status === 'rejected' && w.reject_reason && (
                <span style={{ fontSize: '.75rem', color: 'var(--danger)', width: '100%', marginTop: 4 }}>
                  ✗ {w.reject_reason}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal إيداع */}
      {showDeposit && (
        <Modal title="💳 إيداع USDT" onClose={() => setShowDeposit(false)}>
          <div className="form-group">
            <label className="form-label">طريقة الإيداع</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['binance', 'trc20', 'ton'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDepForm(f => ({ ...f, method: m, address: '' }))}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: '.78rem', cursor: 'pointer',
                    border: `1px solid ${depForm.method === m ? 'var(--accent)' : 'var(--border)'}`,
                    background: depForm.method === m ? 'rgba(108,99,255,.15)' : 'none',
                    color: depForm.method === m ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: depForm.method === m ? 700 : 400,
                  }}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <input style={inputStyle} type="number" placeholder="المبلغ (USDT)" value={depForm.amount}
            onChange={e => setDepForm(f => ({ ...f, amount: e.target.value }))} />
          <input style={inputStyle} placeholder={METHOD_PLACEHOLDERS[depForm.method]}
            value={depForm.address} onChange={e => setDepForm(f => ({ ...f, address: e.target.value }))} />
          {error && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: 8 }}>{error}</p>}
          <button style={btnPrimary} onClick={submitDeposit} disabled={loading}>
            {loading ? '⏳ جاري الإرسال...' : '✅ إرسال طلب الإيداع'}
          </button>
        </Modal>
      )}

      {/* Modal سحب */}
      {showWithdraw && (
        <Modal title="💸 سحب USDT" onClose={() => setShowWithdraw(false)}>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 14 }}>
            رصيدك: <strong>{parseFloat(user?.balance || 0).toFixed(2)} USDT</strong>
          </p>
          <div className="form-group">
            <label className="form-label">طريقة السحب</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['binance', 'trc20', 'ton'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWithForm(f => ({ ...f, method: m, address: '' }))}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: '.78rem', cursor: 'pointer',
                    border: `1px solid ${withForm.method === m ? 'var(--accent)' : 'var(--border)'}`,
                    background: withForm.method === m ? 'rgba(108,99,255,.15)' : 'none',
                    color: withForm.method === m ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: withForm.method === m ? 700 : 400,
                  }}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <input style={inputStyle} type="number" placeholder="المبلغ (USDT)" value={withForm.amount}
            onChange={e => setWithForm(f => ({ ...f, amount: e.target.value }))} />
          <input style={inputStyle} placeholder={METHOD_PLACEHOLDERS[withForm.method]}
            value={withForm.address} onChange={e => setWithForm(f => ({ ...f, address: e.target.value }))} />
          {error && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: 8 }}>{error}</p>}
          <button style={btnPrimary} onClick={submitWithdraw} disabled={loading}>
            {loading ? '⏳ جاري الإرسال...' : '💸 إرسال طلب السحب'}
          </button>
        </Modal>
      )}
    </div>
  )
}
