// The list of scanned receipts. Storage is injected so this runs without a browser.

const pad = (n) => String(n).padStart(2, '0');

/** Builds a file name from local time, for example receipt-20261103-093000.jpg. */
export function fileNameFor(date, suffix = '') {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `receipt-${day}-${time}${suffix}.jpg`;
}

const newestFirst = (a, b) => b.createdAt - a.createdAt;

export function createQueue(store) {
  const uniqueName = async (date) => {
    const taken = new Set((await store.all()).map((item) => item.name));
    let name = fileNameFor(date);
    for (let n = 2; taken.has(name); n++) name = fileNameFor(date, `-${n}`);
    return name;
  };

  return {
    async add(blob, now = new Date()) {
      const item = {
        id: crypto.randomUUID(),
        name: await uniqueName(now),
        blob,
        status: 'pending',
        createdAt: now.getTime(),
        sharedAt: null,
      };
      await store.put(item);
      return item;
    },

    /** Returns pending receipts first, then shared ones, newest first in each group. */
    async list() {
      const items = await store.all();
      return [
        ...items.filter((item) => item.status === 'pending').sort(newestFirst),
        ...items.filter((item) => item.status !== 'pending').sort(newestFirst),
      ];
    },

    async markShared(id, now = new Date()) {
      const item = await store.get(id);
      if (!item) throw new Error(`Receipt not found: ${id}`);
      await store.put({ ...item, status: 'shared', sharedAt: now.getTime() });
    },

    remove: (id) => store.delete(id),
  };
}
