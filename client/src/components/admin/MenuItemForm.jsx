import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors, imageUrl } from '../../api/client';
import useForm from '../../hooks/useForm';
import FormField from '../common/FormField';

const MAX_IMAGE_MB = 5;

const validators = {
  name: (v) => {
    if (!v.trim()) return 'Name is required';
    if (v.length > 100) return 'Name must be 100 characters or fewer';
    return '';
  },
  description: (v) => (v.length > 500 ? 'Description must be 500 characters or fewer' : ''),
  price: (v) => {
    if (v === '' || v === null) return 'Price is required';
    if (Number.isNaN(Number(v)) || Number(v) < 0) return 'Price must be a number ≥ 0';
    return '';
  },
  category: (v) => (v ? '' : 'Pick a category'),
};

// Props: item (null when creating), categories, onSaved(savedItem), onCancel
export default function MenuItemForm({ item, categories, onSaved, onCancel }) {
  const form = useForm(
    {
      name: item?.name || '',
      description: item?.description || '',
      price: item ? String(item.price) : '',
      category: item?.category?._id || '',
      available: item ? item.available : true,
    },
    validators
  );
  const { values, errors } = form;
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [preview, setPreview] = useState(item?.image ? imageUrl(item.image) : '');
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  // Free the temporary object URL when a new file is chosen or the form closes.
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const onFile = (e) => {
    const f = e.target.files[0];
    setFileError('');
    if (!f) return;
    if (!f.type.startsWith('image/')) return setFileError('Please choose an image file');
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) return setFileError(`Image must be under ${MAX_IMAGE_MB} MB`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!form.validateAll() || fileError) return;

    const body = new FormData();
    body.append('name', values.name.trim());
    body.append('description', values.description.trim());
    body.append('price', values.price);
    body.append('category', values.category);
    body.append('available', values.available);
    if (file) body.append('image', file);

    setSaving(true);
    try {
      const { data } = item ? await api.put(`/menu/${item._id}`, body) : await api.post('/menu', body);
      onSaved(data, !item);
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

      <FormField label="Name" name="name" value={values.name} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.name} maxLength={100} />
      <FormField label="Description" name="description" as="textarea" rows={3} value={values.description} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.description} maxLength={500} />

      <div className="form-row">
        <FormField label="Price (₱)" name="price" type="number" step="0.01" min="0" value={values.price} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.price} />
        <FormField label="Category" name="category" as="select" value={values.category} onChange={form.handleChange} onBlur={form.handleBlur} error={errors.category}>
          <option value="">Select…</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </FormField>
      </div>

      <div className="form-field">
        <label htmlFor="f-image">Image</label>
        <input id="f-image" type="file" accept="image/*" onChange={onFile} />
        {fileError && <span className="field-error" role="alert">{fileError}</span>}
        {preview && <img src={preview} alt="Preview" className="image-preview" />}
      </div>

      <label className="check-row">
        <input type="checkbox" name="available" checked={values.available} onChange={form.handleChange} />
        Available to order
      </label>

      <div className="modal-footer inline">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button>
      </div>
    </form>
  );
}
