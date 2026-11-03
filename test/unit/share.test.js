import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canShareFiles,
  copyText,
  isValidEmail,
  outlookComposeUrl,
  shareReceipt,
} from '../../src/share.js';

test('outlookComposeUrl addresses a draft and keeps the @ readable', () => {
  assert.equal(
    outlookComposeUrl('receipts@concur.com'),
    'ms-outlook://compose?to=receipts@concur.com&subject=Receipt',
  );
});

test('outlookComposeUrl escapes characters that would break the link', () => {
  assert.equal(
    outlookComposeUrl('a&b@concur.com'),
    'ms-outlook://compose?to=a%26b@concur.com&subject=Receipt',
  );
});

test('copyText reports success and failure without rejecting', async () => {
  const works = { clipboard: { writeText: async () => {} } };
  const denied = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  assert.equal(await copyText(works, 'x'), true);
  assert.equal(await copyText(denied, 'x'), false);
  assert.equal(await copyText({}, 'x'), false);
});

const file = { name: 'receipt.jpg' };
const ADDRESS = 'receipts@concur.com';

const fakeNav = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    canShare: () => true,
    share: async (data) => void calls.push(['share', data]),
    clipboard: { writeText: async (text) => void calls.push(['copy', text]) },
    ...overrides,
  };
};

const named = (name) => Object.assign(new Error(name), { name });

test('a completed share reports shared and attaches only the file', async () => {
  const nav = fakeNav();
  const result = await shareReceipt({ file, address: ADDRESS, nav });
  assert.equal(result.outcome, 'shared');
  assert.deepEqual(nav.calls.find(([k]) => k === 'share')[1], { files: [file] });
});

test('the address is copied before the share opens, in the same tick', () => {
  const order = [];
  const nav = fakeNav({
    clipboard: { writeText: async () => void order.push('copy') },
    share: async () => void order.push('share'),
  });
  // Deliberately not awaited: Safari only allows share() during the tap, so
  // both calls must have started by the time shareReceipt first yields.
  shareReceipt({ file, address: ADDRESS, nav });
  assert.deepEqual(order, ['copy', 'share']);
});

test('cancelling the share sheet reports cancelled', async () => {
  const nav = fakeNav({ share: async () => { throw named('AbortError'); } });
  const result = await shareReceipt({ file, address: ADDRESS, nav });
  assert.equal(result.outcome, 'cancelled');
});

test('other share errors report failed with the message', async () => {
  const nav = fakeNav({ share: async () => { throw named('NotAllowedError'); } });
  const result = await shareReceipt({ file, address: ADDRESS, nav });
  assert.equal(result.outcome, 'failed');
  assert.match(result.message, /NotAllowedError/);
});

test('unsupported when the browser has no share function', async () => {
  const nav = fakeNav({ share: undefined, canShare: undefined });
  assert.equal((await shareReceipt({ file, address: ADDRESS, nav })).outcome, 'unsupported');
});

test('unsupported when the browser cannot share files', async () => {
  const nav = fakeNav({ canShare: () => false });
  assert.equal((await shareReceipt({ file, address: ADDRESS, nav })).outcome, 'unsupported');
});

test('a clipboard failure does not block the share', async () => {
  const nav = fakeNav({ clipboard: { writeText: async () => { throw new Error('denied'); } } });
  const result = await shareReceipt({ file, address: ADDRESS, nav });
  assert.equal(result.outcome, 'shared');
  assert.equal(result.copied, false);
});

test('a successful copy is reported so the UI can say so', async () => {
  const result = await shareReceipt({ file, address: ADDRESS, nav: fakeNav() });
  assert.equal(result.copied, true);
});

test('a missing clipboard does not block the share', async () => {
  const nav = fakeNav({ clipboard: undefined });
  const result = await shareReceipt({ file, address: ADDRESS, nav });
  assert.equal(result.outcome, 'shared');
  assert.equal(result.copied, false);
});

test('canShareFiles tolerates canShare throwing', () => {
  const nav = fakeNav({ canShare: () => { throw new Error('boom'); } });
  assert.equal(canShareFiles(nav, file), false);
});

test('isValidEmail accepts Concur addresses and rejects junk', () => {
  assert.equal(isValidEmail('receipts@concur.com'), true);
  assert.equal(isValidEmail(' receipts@expenseit.com '), true);
  assert.equal(isValidEmail('receipts'), false);
  assert.equal(isValidEmail('a b@c.com'), false);
  assert.equal(isValidEmail(''), false);
});
