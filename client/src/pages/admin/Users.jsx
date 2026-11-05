import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import useForm from '../../hooks/useForm';
import SearchBar from '../../components/common/SearchBar';
import FilterSelect from '../../components/common/FilterSelect';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import { formatDateTime } from '../../utils/format';

const passwordRule = (v) => {
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(v)) return 'Password needs a letter';
  if (!/\d/.test(v)) return 'Password needs a number';
  return '';
};

function UserForm({ user, onSaved, onCancel }) {
  const editing = !!user;
  const validators = {
    username: (v) => {
      if (editing) return '';
      if (v.length < 3 || v.length > 30) return 'Username must be 3-30 characters';
      return /^[a-zA-Z0-9_]+$/.test(v) ? '' : 'Letters, numbers and underscores only';
    },
    email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? '' : 'Enter a valid email'),
    // On edit, leave blank to keep the current password.
    password: (v) => (editing && !v ? '' : passwordRule(v)),
    role: (v) => (['admin', 'staff'].includes(v) ? '' : 'Choose a role'),
  };
  const form = useForm({ username: user?.username || '', email: user?.email || '', password: '', role: user?.role || 'staff' }, validators);
  const { values, errors } = form;
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!form.validateAll()) return;
    setSaving(true);
    try {
      let data;
      if (editing) {
        const body = { email: values.email.trim(), role: values.role };
        if (values.password) body.password = values.password;
        ({ data } = await api.put(`/users/${user.id}`, body));
      } else {
        ({ data } = await api.post('/users', { username: values.username.trim(), email: values.email.trim(), password: values.password, role: values.role }));
      }
      onSaved(data, !editing);
    } catch (err) {
      form.setErrors(fieldErrors(err));
      setServerError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="stack">
      {serverError && <div className="alert alert-error">{serverError}</div>}
      <FormField label="Username" name="username" value={values.username} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.username} disabled={editing} maxLength={30} autoComplete="off" />
      <FormField label="Email" name="email" type="email" value={values.email} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.email} autoComplete="off" />
      <FormField
        label={editing ? 'New password' : 'Password'}
        name="password"
        type="password"
        value={values.password}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={errors.password}
        hint={editing ? 'Leave blank to keep the current password.' : 'At least 8 characters, with a letter and a number.'}
        autoComplete="new-password"
      />
      <FormField label="Role" name="role" as="select" value={values.role} onChange={form.handleChange} error={errors.role}>
        <option value="staff">Staff: manages orders</option>
        <option value="admin">Admin: full access</option>
      </FormField>
      <div className="modal-footer inline">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const q = useDebounce(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/users', { params: { search: q || undefined, role: role || undefined } })
      .then(({ data }) => { if (!cancelled) { setUsers(data); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not load users.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, role, reload]);

  const onSaved = (saved, created) => {
    setEditing(undefined);
    toast(created ? `User “${saved.username}” created` : `User “${saved.username}” updated`);
    setReload((n) => n + 1);
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      toast(`${u.username} ${u.isActive ? 'deactivated' : 'activated'}`);
      setReload((n) => n + 1);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/users/${deleting.id}`);
      toast(`User “${deleting.username}” deleted`);
      setReload((n) => n + 1);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const columns = [
    { key: 'username', header: 'Username', render: (u) => <strong>{u.username}{u.id === me.id ? ' (you)' : ''}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => <span className={`role-pill role-${u.role}`}>{u.role}</span> },
    { key: 'isActive', header: 'Status', render: (u) => <span className={`status-badge ${u.isActive ? 'status-completed' : 'status-cancelled'}`}>{u.isActive ? 'active' : 'inactive'}</span> },
    { key: 'lastLogin', header: 'Last login', render: (u) => (u.lastLogin ? formatDateTime(u.lastLogin) : 'Never') },
    {
      key: 'actions',
      header: 'Actions',
      className: 'actions',
      render: (u) => {
        const self = u.id === me.id;
        return (
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)} disabled={self}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(u)} disabled={self}>Delete</button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>+ Add user</button>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search username or email…" />
        <FilterSelect label="Role" value={role} onChange={setRole} options={[{ value: 'admin', label: 'Admin' }, { value: 'staff', label: 'Staff' }]} allLabel="All roles" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card flush">
        <DataTable columns={columns} rows={users} rowKey="id" loading={loading} emptyMessage="No users match these filters." />
      </div>

      {editing !== undefined && (
        <Modal title={editing ? `Edit ${editing.username}` : 'Add user'} onClose={() => setEditing(undefined)}>
          <UserForm user={editing} onSaved={onSaved} onCancel={() => setEditing(undefined)} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete user?"
          message={`Delete “${deleting.username}”? Users who have handled orders can't be deleted. Deactivate them instead.`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
