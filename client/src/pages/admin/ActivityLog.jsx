import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import { formatDateTime } from '../../utils/format';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/reports/activity', { params: { limit: 200 } })
      .then(({ data }) => setLogs(data))
      .catch((e) => setError(errorMessage(e, 'Could not load the activity log.')))
      .finally(() => setLoading(false));
  }, []);

  // Client-side filter: the log is already capped at 200 rows.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => `${l.user?.username} ${l.action} ${l.details}`.toLowerCase().includes(q));
  }, [logs, search]);

  const columns = [
    { key: 'createdAt', header: 'When', render: (l) => formatDateTime(l.createdAt) },
    { key: 'user', header: 'User', render: (l) => l.user?.username || '(deleted user)' },
    { key: 'action', header: 'Action', render: (l) => <code>{l.action}</code> },
    { key: 'details', header: 'Details' },
  ];

  return (
    <>
      <div className="page-head"><h1>Activity Log</h1><span className="muted">Latest 200 events</span></div>
      <div className="toolbar"><SearchBar value={search} onChange={setSearch} placeholder="Search user, action or details…" /></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card flush">
        <DataTable columns={columns} rows={shown} loading={loading} emptyMessage="No activity recorded." />
      </div>
    </>
  );
}
