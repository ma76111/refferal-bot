import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

const DEP_STATUS  = { pending: 'قيد المراجعة ⏳', accept: 'مقبول ✅', reject: 'مرفوض ❌' }
const WITH_STATUS = { pending: 'قيد المراجعة ⏳', completed: 'مكتمل ✅', rejected: 'مرفوض ❌' }

export default function Wallet() {
  const { user } = useAuth()
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [tab, setTab] = useState('deposits')

  useEffect(() => {
    api.get('/wallet/deposits').then(r => setDeposits(r.data))
    api.get('/wallet/withdrawals').then(r => setWithdrawals(r.data))
  }, [])

  return (
    <div className="page">
      <h2>المحفظة</h2>
      <div className="balance-banner">
        <span>💰 الرصيد الحالي</span>
        <strong>{parseFloat(user?.balance || 0).toFixed(2)} USDT</strong>
      </div>

      <div className="wallet-note">
        لإجراء إيداع أو سحب، استخدم البوت مباشرة على تيليجرام.
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
              <span className={`badge ${d.status}`}>{DEP_STATUS[d.status] || d.status}</span>
              <span className="tx-date">{new Date(d.created_at).toLocaleDateString('ar')}</span>
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
              <span className={`badge ${w.status}`}>{WITH_STATUS[w.status] || w.status}</span>
              <span className="tx-date">{new Date(w.created_at).toLocaleDateString('ar')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
