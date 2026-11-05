import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import ReportShell from '../../components/admin/ReportShell';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import FilterSelect from '../../components/common/FilterSelect';
import DataTable from '../../components/common/DataTable';
import { daysAgo, toDateInput, peso } from '../../utils/format';

export default function BestSellers() {
  const [range, setRange] = useState({ from: daysAgo(29), to: toDateInput(new Date()) });
  const [limit, setLimit] = useState('10');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const invalid = range.from && range.to && range.from > range.to;

  useEffect(() => {
    if (invalid) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get('/reports/best-sellers', { params: { from: range.from || undefined, to: range.to || undefined, limit } })
      .then(({ data }) => { if (!cancelled) { setReport(data); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not build the report.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, limit, invalid]);

  const rows = (report?.rows || []).map((r, i) => ({ ...r, rank: i + 1 }));
  const columns = [
    { key: 'rank', header: '#', className: 'num' },
    { key: 'name', header: 'Dish', render: (r) => <strong>{r.name}</strong> },
    { key: 'category', header: 'Category' },
    { key: 'quantity', header: 'Qty sold', className: 'num' },
    { key: 'revenue', header: 'Revenue', className: 'num', render: (r) => peso(r.revenue) },
  ];

  return (
    <ReportShell
      title="Best Sellers"
      subtitle={`top ${limit}`}
      from={range.from}
      to={range.to}
      generatedAt={report?.generatedAt}
      controls={
        <>
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          <FilterSelect
            label="Show"
            value={limit}
            onChange={(v) => setLimit(v || '10')}
            allLabel="Top 10"
            options={[{ value: '5', label: 'Top 5' }, { value: '20', label: 'Top 20' }, { value: '50', label: 'Top 50' }]}
          />
        </>
      }
    >
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card flush">
        <DataTable columns={columns} rows={rows} rowKey="rank" loading={loading} emptyMessage="No sales in this period." />
        {report && rows.length > 0 && (
          <div className="report-total">
            <span>Totals ({report.totals.quantity} items)</span>
            <strong>{peso(report.totals.revenue)}</strong>
          </div>
        )}
      </div>
      <p className="muted note">Cancelled orders are excluded.</p>
    </ReportShell>
  );
}
