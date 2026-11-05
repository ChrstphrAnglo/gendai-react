import { useState } from 'react';
import { imageUrl } from '../../api/client';
import { peso } from '../../utils/format';

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the value is still visible */
    }
  };
  return (
    <div className="pay-row">
      <span className="pay-row-label">{label}</span>
      <strong className="pay-row-value">{value}</strong>
      <button type="button" className="pay-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

// Where to send the money for QR Ph, GCash and bank transfer, using the restaurant's own accounts
// (set by the admin under Settings). Props: method, amount, payment (from GET /settings).
export default function PaymentDetails({ method, amount, payment = {} }) {
  const qr = method === 'qrph' ? payment.qrphImage : method === 'gcash' ? payment.gcashImage : '';
  const accountName = method === 'qrph' ? payment.qrphName : method === 'gcash' ? payment.gcashName : payment.bankAccountName;
  const nothingSetUp = method === 'bank_transfer'
    ? !payment.bankAccountNumber
    : !qr && !(method === 'gcash' && payment.gcashNumber);

  return (
    <div className="pay-details">
      <div className="pay-amount">
        <span>Amount to send</span>
        <strong>{peso(amount)}</strong>
      </div>

      {nothingSetUp ? (
        <p className="pay-missing">These payment details are not set up yet. Please pay at the front desk.</p>
      ) : (
        <>
          {qr && (
            <figure className="pay-qr">
              <img src={imageUrl(qr)} alt={`${method === 'qrph' ? 'QR Ph' : 'GCash'} QR code`} />
              <figcaption>
                Scan with your banking or e-wallet app. On this same phone, save the QR and choose
                “Upload QR / Scan from gallery” in your app.
              </figcaption>
              <a className="pay-save" href={imageUrl(qr)} download target="_blank" rel="noreferrer">Save QR image</a>
            </figure>
          )}
          <div className="pay-rows">
            {method === 'bank_transfer' && <CopyRow label="Bank" value={payment.bankName} />}
            <CopyRow label="Account name" value={accountName} />
            {method === 'gcash' && <CopyRow label="GCash number" value={payment.gcashNumber} />}
            {method === 'bank_transfer' && <CopyRow label="Account number" value={payment.bankAccountNumber} />}
          </div>
        </>
      )}
    </div>
  );
}
