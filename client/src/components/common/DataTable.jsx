// Props:
//   columns: [{ key, header, render?(row), className? }]
//   rows, rowKey (defaults to _id), loading, emptyMessage
export default function DataTable({ columns, rows, rowKey = '_id', loading = false, emptyMessage = 'Nothing to show.' }) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }
  if (!rows.length) return <div className="empty-state">{emptyMessage}</div>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={c.className} data-label={c.header}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
