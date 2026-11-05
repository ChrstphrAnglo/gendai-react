import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage, imageUrl } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import SearchBar from '../../components/common/SearchBar';
import FilterSelect from '../../components/common/FilterSelect';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MenuItemForm from '../../components/admin/MenuItemForm';
import { peso } from '../../utils/format';

export default function MenuManager() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const q = useDebounce(search);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data)).catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/menu', { params: { search: q || undefined, category: category || undefined, available: availability || undefined } })
      .then(({ data }) => { if (!cancelled) { setItems(data); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not load menu items.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, category, availability]);

  const onSaved = (saved, created) => {
    setItems((prev) => (created ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)) : prev.map((i) => (i._id === saved._id ? saved : i))));
    setEditing(undefined);
    toast(created ? `“${saved.name}” added` : `“${saved.name}” updated`);
  };

  const toggleAvailable = async (item) => {
    try {
      const body = new FormData();
      body.append('available', !item.available);
      const { data } = await api.put(`/menu/${item._id}`, body);
      setItems((prev) => prev.map((i) => (i._id === data._id ? data : i)));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/menu/${deleting._id}`);
      if (data.softDeleted) {
        setItems((prev) => prev.map((i) => (i._id === deleting._id ? { ...i, available: false } : i)));
      } else {
        setItems((prev) => prev.filter((i) => i._id !== deleting._id));
      }
      toast(data.message);
      setDeleting(null);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c._id, label: c.name })), [categories]);

  const columns = [
    { key: 'image', header: '', render: (i) => <img src={imageUrl(i.image)} alt="" className="thumb" /> },
    { key: 'name', header: 'Name', render: (i) => <strong>{i.name}</strong> },
    { key: 'category', header: 'Category', render: (i) => i.category?.name || '—' },
    { key: 'price', header: 'Price', className: 'num', render: (i) => peso(i.price) },
    {
      key: 'available',
      header: 'Available',
      render: (i) => (
        <label className="switch" title="Toggle availability">
          <input type="checkbox" checked={i.available} onChange={() => toggleAvailable(i)} aria-label={`${i.name} available`} />
          <span className="slider" />
        </label>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'actions',
      render: (i) => (
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(i)}>Edit</button>
          <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(i)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Menu Items</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>+ Add item</button>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name…" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={categoryOptions} allLabel="All categories" />
        <FilterSelect
          label="Availability"
          value={availability}
          onChange={setAvailability}
          options={[{ value: 'true', label: 'Available' }, { value: 'false', label: 'Unavailable' }]}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card flush">
        <DataTable columns={columns} rows={items} loading={loading} emptyMessage="No menu items match these filters." />
      </div>

      {editing !== undefined && (
        <Modal title={editing ? `Edit “${editing.name}”` : 'Add menu item'} onClose={() => setEditing(undefined)}>
          <MenuItemForm item={editing} categories={categories} onSaved={onSaved} onCancel={() => setEditing(undefined)} />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete menu item?"
          message={`Delete “${deleting.name}”? If it appears in past orders it will be hidden instead so order history stays intact.`}
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
