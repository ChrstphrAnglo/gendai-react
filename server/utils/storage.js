const fs = require('fs');
const path = require('path');

// Uploaded images. On Vercel the filesystem is read-only, so when BLOB_READ_WRITE_TOKEN is set
// files go to Vercel Blob and the stored value is a full https URL. Locally they are written to
// server/uploads and the stored value is just the file name (served at /uploads/<name>).
const dir = path.join(__dirname, '..', 'uploads');
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const safeName = (original) => {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40) || 'image';
  return `${base}-${Date.now()}${ext}`;
};

// file: a multer memory-storage file. Returns the value to store in the database.
exports.save = async (file) => {
  const name = safeName(file.originalname);
  if (useBlob()) {
    const { put } = require('@vercel/blob');
    const blob = await put(`uploads/${name}`, file.buffer, { access: 'public', contentType: file.mimetype, addRandomSuffix: true });
    return blob.url;
  }
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), file.buffer);
  return name;
};

// Best effort: a failed delete only leaves an orphaned file behind.
exports.remove = async (stored) => {
  if (!stored) return;
  try {
    if (/^https?:\/\//.test(stored)) {
      if (useBlob()) await require('@vercel/blob').del(stored);
      return;
    }
    await fs.promises.unlink(path.join(dir, path.basename(stored)));
  } catch {
    /* already gone */
  }
};
