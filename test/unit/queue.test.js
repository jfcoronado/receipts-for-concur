import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, fileNameFor } from '../../src/queue.js';

/** In-memory stand-in with the same interface as the IndexedDB store. */
const memoryStore = () => {
  const items = new Map();
  return {
    put: async (item) => void items.set(item.id, item),
    get: async (id) => items.get(id),
    delete: async (id) => void items.delete(id),
    all: async () => [...items.values()],
  };
};

const at = (iso) => new Date(iso);
const blob = { size: 1234, type: 'image/jpeg' };

test('fileNameFor uses local time with zero padding', () => {
  assert.equal(fileNameFor(new Date(2026, 0, 5, 7, 8, 9)), 'receipt-20260105-070809.jpg');
});

test('a new receipt is pending and named from its scan time', async () => {
  const queue = createQueue(memoryStore());
  const when = new Date(2026, 10, 3, 9, 30, 0);
  const item = await queue.add(blob, when);
  assert.equal(item.status, 'pending');
  assert.equal(item.name, 'receipt-20261103-093000.jpg');
  assert.equal(item.blob, blob);
  assert.equal(item.sharedAt, null);
});

test('two scans in the same second get different ids and names', async () => {
  const queue = createQueue(memoryStore());
  const when = new Date(2026, 10, 3, 9, 30, 0);
  const a = await queue.add(blob, when);
  const b = await queue.add(blob, when);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.name, b.name);
  assert.equal(b.name, 'receipt-20261103-093000-2.jpg');
});

test('list shows pending first, then newest first', async () => {
  const queue = createQueue(memoryStore());
  const old = await queue.add(blob, at('2026-11-01T10:00:00Z'));
  const shared = await queue.add(blob, at('2026-11-03T10:00:00Z'));
  const recent = await queue.add(blob, at('2026-11-02T10:00:00Z'));
  await queue.markShared(shared.id, at('2026-11-03T11:00:00Z'));
  const ids = (await queue.list()).map((i) => i.id);
  assert.deepEqual(ids, [recent.id, old.id, shared.id]);
});

test('markShared records status and time', async () => {
  const queue = createQueue(memoryStore());
  const item = await queue.add(blob, at('2026-11-03T10:00:00Z'));
  const when = at('2026-11-03T11:00:00Z');
  await queue.markShared(item.id, when);
  const [stored] = await queue.list();
  assert.equal(stored.status, 'shared');
  assert.equal(stored.sharedAt, when.getTime());
});

test('markShared on a deleted receipt fails loudly', async () => {
  const queue = createQueue(memoryStore());
  await assert.rejects(() => queue.markShared('missing', new Date()), /not found/i);
});

test('remove deletes the receipt', async () => {
  const queue = createQueue(memoryStore());
  const item = await queue.add(blob, new Date());
  await queue.remove(item.id);
  assert.deepEqual(await queue.list(), []);
});

test('receipts persist across queue instances on the same store', async () => {
  const store = memoryStore();
  const item = await createQueue(store).add(blob, new Date());
  const [found] = await createQueue(store).list();
  assert.equal(found.id, item.id);
});
