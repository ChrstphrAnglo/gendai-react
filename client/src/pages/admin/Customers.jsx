import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useDebounce from '../../hooks/useDebounce';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import { formatDate } from '../../utils/format';

// Read-only list of customer accounts.
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);

  useEffect(() => {
    let cancelled = false;
    api.get('/customers')
      .then(({ data }) => { if (!cancelled) setCustomers(data); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not load customers.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => [c.fullName, c.email, c.phone].some((v) => v?.toLowerCase().includes(term)));
  }, [customers, q]);

  const columns = [
    { key: 'fullName', header: 'Name', render: (c) => <strong>{c.fullName || '—'}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
    { key: 'orders', header: 'Orders', className: 'num' },
    { key: 'createdAt', header: 'Joined', render: (c) => formatDate(c.createdAt) },
    {
      key: 'isActive',
      header: 'Status',
      render: (c) => (
        <span className={`status-badge ${c.isActive ? 'status-delivered' : 'status-cancelled'}`}>{c.isActive ? 'active' : 'inactive'}</span>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Customers</h1>
        <span className="muted">{shown.length} shown</span>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, email or phone…" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card flush">
        <DataTable columns={columns} rows={shown} rowKey="id" loading={loading} emptyMessage="No customers have signed up yet." />
      </div>
    </>
  );
}
