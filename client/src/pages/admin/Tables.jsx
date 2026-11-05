import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import api, { errorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

// QR codes point at whatever address this page is opened from, so print them from the live (Vercel) site.
const tableUrl = (token) => `${window.location.origin}/t/${token}`;
const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);

function useQrImages(tables) {
  const [images, setImages] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(tables.map(async (t) => [t._id, await QRCode.toDataURL(tableUrl(t.token), {
      margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#14151a', light: '#ffffff' },
    })])).then((pairs) => { if (!cancelled) setImages(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [tables]);
  return images;
}

export default function Tables() {
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [labelError, setLabelError] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'regenerate' | 'delete', table }
  const [busy, setBusy] = useState(false);
  const qr = useQrImages(tables);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/tables');
      setTables(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load tables.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!label.trim()) return setLabelError('Enter a table name, e.g. T1 or Bar 2');
    setBusy(true);
    try {
      await api.post('/tables', { label: label.trim() });
      toast(`Table ${label.trim()} added`);
      setLabel('');
      await load();
    } catch (err) {
      setLabelError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const save = async (changes, table = editing) => {
    setBusy(true);
    try {
      await api.put(`/tables/${table._id}`, changes);
      setEditing(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    setBusy(true);
    try {
      if (confirm.kind === 'regenerate') {
        await api.post(`/tables/${confirm.table._id}/regenerate`);
        toast(`New QR code for ${confirm.table.label}. Print and replace the old one.`);
      } else {
        await api.delete(`/tables/${confirm.table._id}`);
        toast(`Table ${confirm.table.label} deleted`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const active = tables.filter((t) => t.active);

  return (
    <>
      <div className="page-head no-print">
        <h1>Tables &amp; QR codes</h1>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={active.length === 0}>Print QR codes</button>
      </div>

      {isLocal && (
        <div className="alert alert-warn no-print">
          You are on <b>{window.location.host}</b>. QR codes printed from here only work on this computer.
          Open this page on your live site (your Vercel address) before printing.
        </div>
      )}
      {error && <div className="alert alert-error no-print">{error}</div>}

      <form className="card table-add no-print" onSubmit={add} noValidate>
        <FormField
          label="New table"
          name="label"
          value={label}
          onChange={(e) => { setLabel(e.target.value); setLabelError(''); }}
          error={labelError}
          placeholder="e.g. T7, Bar 2, Counter"
          maxLength={30}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>Add table</button>
      </form>

      {loading && <div className="loading-container"><div className="loading-spinner" /></div>}
      {!loading && tables.length === 0 && <div className="card empty-state no-print">No tables yet. Add your first table above.</div>}

      <div className="qr-grid no-print">
        {tables.map((t) => (
          <article key={t._id} className={`qr-card ${t.active ? '' : 'is-off'}`}>
            <div className="qr-card-img">{qr[t._id] ? <img src={qr[t._id]} alt={`QR code for ${t.label}`} /> : <div className="loading-spinner" />}</div>
            <div className="qr-card-body">
              <h3>{t.label}</h3>
              <a className="qr-link" href={tableUrl(t.token)} target="_blank" rel="noreferrer">{tableUrl(t.token).replace(/^https?:\/\//, '')}</a>
              <label className="check-row">
                <span className="switch">
                  <input type="checkbox" checked={t.active} onChange={(e) => save({ active: e.target.checked }, t)} />
                  <span className="slider" />
                </span>
                {t.active ? 'Taking orders' : 'Off'}
              </label>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...t })}>Rename</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm({ kind: 'regenerate', table: t })}>New QR</button>
                <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setConfirm({ kind: 'delete', table: t })}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Printed sheet: one card per active table */}
      <div className="qr-print-sheet" aria-hidden="true">
        {active.map((t) => (
          <div key={t._id} className="qr-print-card">
            <img src="/new logo 1.png" alt="" className="qr-print-logo" />
            {qr[t._id] && <img src={qr[t._id]} alt="" className="qr-print-code" />}
            <div className="qr-print-table">Table {t.label}</div>
            <div className="qr-print-hint">Scan to order · Dine in or Take out</div>
            <div className="qr-print-jp">ご注文はこちら</div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={`Rename ${tables.find((t) => t._id === editing._id)?.label}`}
          onClose={() => setEditing(null)}
          footer={(
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy || !editing.label.trim()} onClick={() => save({ label: editing.label.trim() })}>Save</button>
            </>
          )}
        >
          <FormField label="Table name" name="label" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} maxLength={30} />
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'regenerate' ? `New QR code for ${confirm.table.label}?` : `Delete ${confirm.table.label}?`}
          message={confirm.kind === 'regenerate'
            ? 'The QR code currently on this table will stop working. Print the new one and replace it.'
            : 'Tables with past orders cannot be deleted; switch them off instead.'}
          confirmLabel={confirm.kind === 'regenerate' ? 'Make new QR' : 'Delete'}
          danger={confirm.kind === 'delete'}
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
