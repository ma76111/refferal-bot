import { useState, useEffect, useCallback } from 'react'
import api from '../api'

/**
 * Hook لجلب سجل الأنشطة مع pagination وتصفية حسب النوع
 * @param {object} options
 * @param {number} options.pageSize - عدد الأنشطة في الصفحة (افتراضي 20)
 * @param {string} options.eventType - تصفية حسب نوع الحدث (فارغ = الكل)
 */
export function useActivityLog({ pageSize = 20, eventType = '' } = {}) {
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetch = useCallback(async (pg = page) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: pg, pageSize })
      if (eventType) params.set('eventType', eventType)
      const r = await api.get(`/user/activity?${params}`)
      setData(r.data?.data || [])
      setTotal(r.data?.total || 0)
    } catch (err) {
      setError(err.response?.data?.error || 'فشل تحميل الأنشطة')
    }
    setLoading(false)
  }, [page, pageSize, eventType])

  useEffect(() => { fetch(page) }, [fetch, page])

  function goToPage(pg) {
    const clamped = Math.max(1, Math.min(totalPages, pg))
    setPage(clamped)
  }

  return {
    data,
    total,
    page,
    totalPages,
    loading,
    error,
    goToPage,
    reload: () => fetch(page),
  }
}
