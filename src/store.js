// IndexedDB storage for receipts, implementing the interface queue.js expects.

const DB_NAME = 'receipts';
const STORE = 'receipts';

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function openStore() {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' });
  const db = await request(open);

  const run = async (mode, action) => {
    const tx = db.transaction(STORE, mode);
    const result = await request(action(tx.objectStore(STORE)));
    if (mode === 'readwrite') {
      // Wait for the commit, so a saved receipt is really on disk.
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    }
    return result;
  };

  return {
    put: (item) => run('readwrite', (s) => s.put(item)),
    get: (id) => run('readonly', (s) => s.get(id)),
    delete: (id) => run('readwrite', (s) => s.delete(id)),
    all: () => run('readonly', (s) => s.getAll()),
  };
}
