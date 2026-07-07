import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'

/**
 * Hook لإدارة الإشعارات مع polling كل 30 ثانية
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const r = await api.get('/notifications/unread-count')
      setUnreadCount(r.data.count || 0)
    } catch (_) { /* ignore */ }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/notifications')
      setNotifications(r.data || [])
      const unread = (r.data || []).filter(n => !n.is_read).length
      setUnreadCount(unread)
    } catch (_) { /* ignore */ }
    setLoading(false)
  }, [])

  const markRead = useCallback(async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (_) { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch (_) { /* ignore */ }
  }, [])

  useEffect(() => {
    // جلب أولي
    fetchUnreadCount()

    // polling كل 30 ثانية
    intervalRef.current = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [fetchUnreadCount])

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
  }
}
