import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';

const validators = {
  name: (v) => {
    if (!v.trim()) return 'Category name is required';
    if (v.length > 50) return 'Name must be 50 characters or fewer';
    return '';
  },
  sortOrder: (v) => (v !== '' && (!/^\d+$/.test(String(v)) || Number(v) < 0) ? 'Use a whole number ≥ 0' : ''),
};

function CategoryForm({ category, onSaved, onCancel }) {
  const form = useForm({ name: category?.name || '', sortOrder: String(category?.sortOrder ?? 0) }, validators);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!form.validateAll()) return;
    setSaving(true);
    const body = { name: form.values.name.trim(), sortOrder: Number(form.values.sortOrder || 0) };
    try {
      const { data } = category ? await api.put(`/categories/${category._id}`, body) : await api.post('/categories', body);
      onSaved(data, !category);
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
      <FormField label="Name" name="name" value={form.values.name} onChange={form.handleChange} onBlur={form.handleBlur} error={form.errors.name} maxLength={50} />
      <FormField label="Sort order" name="sortOrder" type="number" min="0" value={form.values.sortOrder} onChange={form.handleChange} onBlur={form.handleBlur} error={form.errors.sortOrder} hint="Lower numbers appear first on the menu." />
      <div className="modal-footer inline">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.get('/categories')
      .then(({ data }) => { setCategories(data); setError(''); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const onSaved = (saved, created) => {
    setEditing(undefined);
    toast(created ? `“${saved.name}” created` : `“${saved.name}” updated`);
    load();
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/categories/${deleting._id}`);
      toast(`“${deleting.name}” deleted`);
      setDeleting(null);
      load();
    } catch (err) {
      // e.g. 409: category still has menu items
      toast(errorMessage(err), 'error');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'sortOrder', header: 'Order', className: 'num' },
    { key: 'name', header: 'Name', render: (c) => <strong>{c.name}</strong> },
    { key: 'itemCount', header: 'Menu items', className: 'num' },
    {
      key: 'actions',
      header: 'Actions',
      className: 'actions',
      render: (c) => (
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
          <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(c)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Categories</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>+ Add category</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card flush">
        <DataTable columns={columns} rows={categories} loading={loading} emptyMessage="No categories yet." />
      </div>

      {editing !== undefined && (
        <Modal title={editing ? 'Edit category' : 'Add category'} onClose={() => setEditing(undefined)}>
          <CategoryForm category={editing} onSaved={onSaved} onCancel={() => setEditing(undefined)} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete category?"
          message={`Delete “${deleting.name}”? Categories that still contain menu items can't be deleted.`}
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
