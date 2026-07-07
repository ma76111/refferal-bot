import { useState, useMemo } from 'react';

/**
 * مكون Table شامل مع دعم الفرز والتصفية والـ Pagination
 * @param {Array} columns - أعمدة الجدول [{key, label, sortable, render}]
 * @param {Array} data - بيانات الجدول
 * @param {number} pageSize - عدد الصفوف في الصفحة
 * @param {boolean} searchable - هل يوجد بحث
 * @param {string} emptyMessage - رسالة البيانات الفارغة
 */
export function Table({
  columns = [],
  data = [],
  pageSize = 10,
  searchable = false,
  emptyMessage = 'لا توجد بيانات',
  className = '',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleSearch(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className={`table-wrapper ${className}`}>
      {searchable && (
        <div className="table-search">
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="بحث..."
            aria-label="Search table"
            className="table-search-input"
          />
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table" role="table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={col.sortable ? 'sortable' : ''}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : col.sortable ? 'none' : undefined
                  }
                  scope="col"
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="sort-icon" aria-hidden="true">
                      {sortDir === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={row.id ?? idx}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination" role="navigation" aria-label="Pagination">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            aria-label="First page"
            className="pagination-btn"
          >«</button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="pagination-btn"
          >‹</button>
          <span className="pagination-info">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="pagination-btn"
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            aria-label="Last page"
            className="pagination-btn"
          >»</button>
        </div>
      )}
    </div>
  );
}

export default Table;
