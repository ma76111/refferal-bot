/**
 * مكون Spinner - يظهر عند العمليات التي تستغرق أكثر من 300ms
 * @param {boolean} fullScreen - هل يملأ الشاشة كاملة
 * @param {string} size - الحجم: 'sm' | 'md' | 'lg'
 */
export function Spinner({ fullScreen = false, size = 'md' }) {
  if (fullScreen) {
    return (
      <div className="spinner-overlay" role="status" aria-label="Loading">
        <div className={`spinner spinner-${size}`} />
      </div>
    );
  }
  return (
    <div className={`spinner spinner-${size}`} role="status" aria-label="Loading" />
  );
}

/**
 * مكون SkeletonLoader - للمحتوى الذي يتحمل
 */
export function SkeletonLoader({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-wrapper ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export default Spinner;
