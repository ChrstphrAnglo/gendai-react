import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import ReportShell from '../../components/admin/ReportShell';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import FilterSelect from '../../components/common/FilterSelect';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import { daysAgo, toDateInput, peso, formatDate } from '../../utils/format';

export default function SalesReport() {
  const [range, setRange] = useState({ from: daysAgo(29), to: toDateInput(new Date()) });
  const [groupBy, setGroupBy] = useState('day');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const invalid = range.from && range.to && range.from > range.to;

  useEffect(() => {
    if (invalid) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get('/reports/sales', { params: { from: range.from || undefined, to: range.to || undefined, groupBy } })
      .then(({ data }) => { if (!cancelled) { setReport(data); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not build the report.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, groupBy, invalid]);

  const byCategory = groupBy === 'category';
  const byChannel = groupBy === 'channel';
  const columns = [
    {
      key: 'label',
      header: byCategory ? 'Category' : byChannel ? 'Order type' : 'Date',
      render: (r) => (byCategory || byChannel ? r.label : formatDate(`${r.label}T00:00:00`)),
    },
    { key: 'orders', header: 'Orders', className: 'num' },
    ...(byCategory ? [{ key: 'itemsSold', header: 'Items sold', className: 'num' }] : []),
    ...(byCategory ? [] : [{ key: 'deliveryFees', header: 'Delivery fees', className: 'num', render: (r) => peso(r.deliveryFees) }]),
    { key: 'revenue', header: byCategory ? 'Revenue (items)' : 'Revenue', className: 'num', render: (r) => peso(r.revenue) },
  ];

  return (
    <ReportShell
      title="Sales Report"
      subtitle={byCategory ? 'by category' : byChannel ? 'by order type' : 'by day'}
      from={range.from}
      to={range.to}
      generatedAt={report?.generatedAt}
      controls={
        <>
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          <FilterSelect label="Group by" value={groupBy} onChange={(v) => setGroupBy(v || 'day')} allLabel="Day" options={[{ value: 'category', label: 'Category' }, { value: 'channel', label: 'Order type' }]} />
        </>
      }
    >
      {error && <div className="alert alert-error">{error}</div>}

      {report && (
        <div className="stats-grid report-stats">
          <StatCard label="Total revenue" value={peso(report.totals.revenue)} tone="ok" />
          {!byCategory && <StatCard label="Delivery fees" value={peso(report.totals.deliveryFees)} />}
          <StatCard label={byCategory ? 'Order lines' : 'Orders'} value={report.totals.orders} />
          {byCategory && <StatCard label="Items sold" value={report.totals.itemsSold} />}
          <StatCard label="Average / order" value={report.totals.orders && !byCategory ? peso(report.totals.revenue / report.totals.orders) : '—'} />
        </div>
      )}

      <div className="card flush">
        <DataTable columns={columns} rows={report?.rows || []} rowKey="label" loading={loading} emptyMessage="No sales in this period." />
        {report && report.rows.length > 0 && (
          <div className="report-total"><span>Total</span><strong>{peso(report.totals.revenue)}</strong></div>
        )}
      </div>
      <p className="muted note">Cancelled orders and unpaid take-out orders are excluded from all sales figures.</p>
    </ReportShell>
  );
}
