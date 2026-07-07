import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'

/** خريطة أنواع الإشعارات إلى مسارات الصفحات */
const TYPE_LINKS = {
  submission_accepted:  '/submissions',
  submission_rejected:  '/submissions',
  task_completed:       '/my-tasks',
  ticket_reply:         '/tickets',
  deposit_completed:    '/wallet',
  withdrawal_completed: '/wallet',
  promotional:          '/',
  system_update:        '/',
}

/** أيقونات الأنواع */
const TYPE_ICONS = {
  submission_accepted:  '✅',
  submission_rejected:  '❌',
  task_completed:       '🏆',
  ticket_reply:         '💬',
  deposit_completed:    '💰',
  withdrawal_completed: '💸',
  promotional:          '🎉',
  system_update:        '🔔',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications()

  // إغلاق الـ dropdown عند النقر خارجه
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleToggle() {
    if (!open) fetchNotifications()
    setOpen(o => !o)
  }

  async function handleNotifClick(notif) {
    if (!notif.is_read) await markRead(notif.id)
    setOpen(false)
    const link = notif.link || TYPE_LINKS[notif.type] || '/'
    navigate(link)
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60)   return 'الآن'
    if (diff < 3600) return `${Math.floor(diff / 60)} د`
    if (diff < 86400) return `${Math.floor(diff / 3600)} س`
    return d.toLocaleDateString('ar')
  }

  return (
    <div className="notif-bell-wrapper" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`الإشعارات${unreadCount > 0 ? ` - ${unreadCount} غير مقروء` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu" aria-label="قائمة الإشعارات">
          <div className="notif-dropdown-header">
            <span>الإشعارات</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="btn-link"
                style={{ fontSize: '.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                تعليم الكل مقروء
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
              جاري التحميل...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '.875rem' }}>
              لا توجد إشعارات
            </div>
          ) : (
            notifications.slice(0, 10).map(notif => (
              <div
                key={notif.id}
                className={`notif-item${!notif.is_read ? ' unread' : ''}`}
                onClick={() => handleNotifClick(notif)}
                role="menuitem"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleNotifClick(notif)}
              >
                <div className="notif-item-title">
                  <span style={{ marginInlineEnd: '6px' }}>
                    {TYPE_ICONS[notif.type] || '🔔'}
                  </span>
                  {notif.title}
                  {!notif.is_read && (
                    <span style={{ marginInlineStart: '6px', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', verticalAlign: 'middle' }} />
                  )}
                </div>
                {notif.body && (
                  <div className="notif-item-body">{notif.body}</div>
                )}
                <div className="notif-item-time">{formatTime(notif.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
