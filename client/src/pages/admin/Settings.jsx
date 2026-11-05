import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors, imageUrl } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import FormField from '../../components/common/FormField';
import { peso } from '../../utils/format';

const EMPTY_PAYMENT = {
  qrphName: '', gcashName: '', gcashNumber: '', bankName: '', bankAccountName: '', bankAccountNumber: '', qrphImage: '', gcashImage: '',
};

// One QR upload slot: preview, replace, remove.
function QrSlot({ label, current, file, removed, onFile, onRemove }) {
  const preview = file ? URL.createObjectURL(file) : (!removed && current ? imageUrl(current) : '');
  return (
    <div className="form-field">
      <label>{label}</label>
      <div className="pay-setting-qr">
        {preview ? <img src={preview} alt={`${label} preview`} /> : <div className="qr-empty">No QR uploaded</div>}
        <div className="pay-setting-actions">
          <label className="btn btn-ghost btn-sm">
            {preview ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
          {preview && <button type="button" className="btn btn-danger-ghost btn-sm" onClick={onRemove}>Remove</button>}
        </div>
      </div>
    </div>
  );
}

// Where guests send QR Ph, GCash and bank-transfer payments. Shown on the dine-in and delivery payment screens.
function PaymentSettings() {
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [files, setFiles] = useState({});
  const [removed, setRemoved] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setValues({ ...EMPTY_PAYMENT, ...data.payment })).catch(() => setValues(EMPTY_PAYMENT));
  }, []);

  if (!values) return <div className="card"><div className="loading-spinner" /></div>;

  const field = (name, label, props = {}) => (
    <FormField
      label={label}
      name={name}
      value={values[name]}
      onChange={(e) => { setValues({ ...values, [name]: e.target.value }); setErrors({ ...errors, [name]: '' }); }}
      error={errors[name]}
      {...props}
    />
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = new FormData();
    ['qrphName', 'gcashName', 'gcashNumber', 'bankName', 'bankAccountName', 'bankAccountNumber'].forEach((k) => body.append(k, values[k].trim()));
    ['qrphImage', 'gcashImage'].forEach((k) => {
      if (files[k]) body.append(k, files[k]);
      else if (removed[k]) body.append(`remove${k.charAt(0).toUpperCase()}${k.slice(1)}`, 'true');
    });
    try {
      const { data } = await api.put('/settings/payment', body);
      setValues({ ...EMPTY_PAYMENT, ...data.payment });
      setFiles({});
      setRemoved({});
      toast('Payment details saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err, 'Could not save payment details.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const slot = (key, label) => (
    <QrSlot
      label={label}
      current={values[key]}
      file={files[key]}
      removed={removed[key]}
      onFile={(f) => { setFiles({ ...files, [key]: f }); setRemoved({ ...removed, [key]: false }); }}
      onRemove={() => { setFiles({ ...files, [key]: null }); setRemoved({ ...removed, [key]: true }); }}
    />
  );

  return (
    <form onSubmit={save} noValidate>
      <div className="page-head" style={{ marginTop: 28 }}>
        <h1>Payment accounts</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save payment details'}</button>
      </div>
      <p className="muted" style={{ marginBottom: 16, maxWidth: 720 }}>
        Guests pay straight into these accounts, then tap &ldquo;I&apos;ve paid&rdquo;. Staff confirm the money arrived on the Front Desk page.
        Use the static QR codes from your bank / GCash business app. Card payments are not offered.
      </p>
      <div className="settings-grid">
        <section className="card pay-setting">
          <div className="card-head"><h2>QR Ph</h2></div>
          {slot('qrphImage', 'QR Ph code')}
          {field('qrphName', 'Account name shown to guests', { placeholder: 'Gendai Japanese Restaurant', maxLength: 80 })}
        </section>
        <section className="card pay-setting">
          <div className="card-head"><h2>GCash</h2></div>
          {slot('gcashImage', 'GCash QR code')}
          {field('gcashName', 'GCash account name', { placeholder: 'G***** R.', maxLength: 80 })}
          {field('gcashNumber', 'GCash number', { placeholder: '0917 123 4567', maxLength: 20, inputMode: 'tel' })}
        </section>
        <section className="card pay-setting">
          <div className="card-head"><h2>Bank transfer</h2></div>
          {field('bankName', 'Bank', { placeholder: 'BPI, BDO, Metrobank…', maxLength: 80 })}
          {field('bankAccountName', 'Account name', { maxLength: 80 })}
          {field('bankAccountNumber', 'Account number', { maxLength: 40, inputMode: 'numeric' })}
        </section>
      </div>
    </form>
  );
}

export default function Settings() {
  const toast = useToast();
  const [fee, setFee] = useState('');
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => { setCurrent(data.deliveryFee); setFee(String(data.deliveryFee)); })
      .catch((e) => setError(errorMessage(e, 'Could not load settings.')));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setFieldError('');
    const value = Number(fee);
    if (fee.trim() === '' || Number.isNaN(value) || value < 0 || value > 10000) {
      setFieldError('Enter an amount between 0 and 10,000');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/settings', { deliveryFee: value });
      setCurrent(data.deliveryFee);
      setFee(String(data.deliveryFee));
      toast(`Delivery fee set to ${peso(data.deliveryFee)}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card" onSubmit={save} style={{ maxWidth: 480 }} noValidate>
        <div className="card-head">
          <h2>Delivery</h2>
          {current !== null && <span className="muted">Current fee: {peso(current)}</span>}
        </div>
        <FormField
          label="Flat delivery fee (₱)"
          name="deliveryFee"
          type="number"
          min="0"
          max="10000"
          step="0.01"
          value={fee}
          onChange={(e) => { setFee(e.target.value); setFieldError(''); }}
          error={fieldError}
          hint="Added to every order. Changes apply to new orders only."
        />
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || current === null}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <PaymentSettings />
    </>
  );
}
