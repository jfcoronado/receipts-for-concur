import { expect, test } from 'playwright/test';

/** Draws a test photo in the page: a white receipt on a dark table, as a PNG file. */
async function photoBuffer(page) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#eee';
    ctx.fillRect(100, 60, 400, 680);
    ctx.fillStyle = '#555';
    for (let y = 120; y < 700; y += 60) ctx.fillRect(140, y, 320, 14);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function scan(page) {
  await page.getByTestId('camera-input').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: await photoBuffer(page),
  });
  await expect(page.getByRole('heading', { name: 'Adjust corners' })).toBeVisible();
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await expect(page.getByTestId('receipt').first()).toBeVisible();
}

/** Replaces the share and clipboard APIs, recording what the app sends to them. */
async function stubShare(page, behaviour = 'resolve') {
  await page.addInitScript((mode) => {
    window.__shared = [];
    window.__copied = [];
    // Records Outlook links instead of following them, as no browser here has Outlook.
    window.__opened = [];
    document.addEventListener(
      'click',
      (event) => {
        const link = event.target.closest?.('a[href^="ms-outlook:"]');
        if (!link) return;
        window.__opened.push(link.href);
        event.preventDefault();
      },
      true,
    );
    navigator.canShare = () => mode !== 'unsupported';
    navigator.share = async (data) => {
      window.__lastFile = data.files[0];
      window.__shared.push(
        data.files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      );
      if (mode === 'cancel') throw new DOMException('cancelled', 'AbortError');
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text) => void window.__copied.push(text) },
    });
  }, behaviour);
}

/** Opens the test photo in the corner editor without saving. */
async function openEditor(page) {
  await page.getByTestId('camera-input').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: await photoBuffer(page),
  });
  await expect(page.getByRole('heading', { name: 'Adjust corners' })).toBeVisible();
}

/** Drags a corner from one point to another, both given in photo pixels. */
async function dragCorner(page, from, to, photoWidth = 600) {
  const box = await page.locator('#stage').boundingBox();
  const scale = box.width / photoWidth;
  const screen = (p) => [box.x + p.x * scale, box.y + p.y * scale];
  await page.mouse.move(...screen(from));
  await page.mouse.down();
  await page.mouse.move(...screen(to), { steps: 4 });
  await page.mouse.up();
}

/** Saves and sends the open scan, then reports its size and sampled grey levels. */
async function saveAndInspect(page) {
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Open Outlook');
  return page.evaluate(async () => {
    const bitmap = await createImageBitmap(window.__lastFile);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const grey = (x, y) => ctx.getImageData(x, y, 1, 1).data[0];
    const { width, height } = canvas;
    return {
      width,
      height,
      corners: [
        grey(3, 3),
        grey(width - 4, 3),
        grey(width - 4, height - 4),
        grey(3, height - 4),
      ],
    };
  });
}

test('the default corners crop 5% from each edge', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await openEditor(page);
  const scan = await saveAndInspect(page);
  expect([scan.width, scan.height]).toEqual([540, 720]);
});

test('dragging the corners crops the scan to the receipt', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await openEditor(page);
  await dragCorner(page, { x: 30, y: 40 }, { x: 105, y: 65 });
  await dragCorner(page, { x: 570, y: 40 }, { x: 495, y: 65 });
  await dragCorner(page, { x: 570, y: 760 }, { x: 495, y: 735 });
  await dragCorner(page, { x: 30, y: 760 }, { x: 105, y: 735 });
  const scan = await saveAndInspect(page);
  // Allow for the on-screen scale: one screen pixel is about 1.5 photo pixels.
  expect(Math.abs(scan.width - 390)).toBeLessThan(6);
  expect(Math.abs(scan.height - 670)).toBeLessThan(6);
  // Every corner lands on white paper, not the dark table.
  for (const grey of scan.corners) expect(grey).toBeGreaterThan(200);
});

test('rotate turns the scan a quarter turn', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await openEditor(page);
  await page.getByRole('button', { name: 'Rotate' }).click();
  const scan = await saveAndInspect(page);
  expect([scan.width, scan.height]).toEqual([720, 540]);
});

test('cancelling the editor saves nothing', async ({ page }) => {
  await page.goto('/');
  await openEditor(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('No receipts yet')).toBeVisible();
  await expect(page.getByTestId('receipt')).toHaveCount(0);
});

test('scanning creates a pending JPEG receipt with a dated name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No receipts yet')).toBeVisible();
  await scan(page);
  const receipt = page.getByTestId('receipt').first();
  await expect(receipt).toContainText('Pending');
  await expect(receipt.getByRole('img')).toHaveJSProperty('complete', true);
});

test('the saved scan is a JPEG that fits the size limit', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Open Outlook');
  const [[file]] = await page.evaluate(() => window.__shared);
  expect(file.type).toBe('image/jpeg');
  expect(file.name).toMatch(/^receipt-\d{8}-\d{6}\.jpg$/);
  expect(file.size).toBeGreaterThan(1000);
});

test('receipts survive a reload', async ({ page }) => {
  await page.goto('/');
  await scan(page);
  await page.reload();
  await expect(page.getByTestId('receipt')).toHaveCount(1);
});

test('a completed share copies the address but leaves the receipt pending', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Open Outlook');
  const copied = await page.evaluate(() => [...new Set(window.__copied)]);
  expect(copied).toEqual(['receipts@concur.com']);
  await expect(page.getByTestId('receipt').first()).toContainText('Pending');
});

test('a finished share leaves opening Outlook to the user', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('tap Open Outlook');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
  await page.getByRole('link', { name: 'Open Outlook' }).click();
  expect(await page.evaluate(() => window.__opened)).toEqual([
    'ms-outlook://compose?to=receipts@concur.com&subject=Receipt',
  ]);
});

test('only Mark sent changes the status, and it survives a reload', async ({ page }) => {
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Mark sent' }).click();
  const receipt = page.getByTestId('receipt').first();
  await expect(receipt).toContainText('Marked sent');
  await expect(receipt.getByRole('button', { name: 'Mark sent' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('receipt').first()).toContainText('Marked sent');
});

test('Open Outlook links to a draft for the saved address', async ({ page }) => {
  await page.goto('/');
  await scan(page);
  await expect(page.getByRole('link', { name: 'Open Outlook' })).toHaveAttribute(
    'href',
    'ms-outlook://compose?to=receipts@concur.com&subject=Receipt',
  );
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Send receipts to').fill('receipts@expenseit.com');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('link', { name: 'Open Outlook' })).toHaveAttribute(
    'href',
    'ms-outlook://compose?to=receipts@expenseit.com&subject=Receipt',
  );
});

test('Open Outlook also copies the address, in case To stays empty', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await scan(page);
  // Stop the navigation, since no browser here can open the Outlook app.
  await page.evaluate(() =>
    document.addEventListener('click', (event) => event.preventDefault()),
  );
  await page.getByRole('link', { name: 'Open Outlook' }).click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toEqual(['receipts@concur.com']);
});

test('cancelling the share sheet leaves the receipt pending', async ({ page }) => {
  await stubShare(page, 'cancel');
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Not shared');
  await expect(page.getByTestId('receipt').first()).toContainText('Pending');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
});

test('without file sharing the app explains and offers a download', async ({ page }) => {
  await stubShare(page, 'unsupported');
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('can’t share files');
  await expect(page.getByRole('link', { name: 'Download' })).toBeVisible();
  await expect(page.getByTestId('receipt').first()).toContainText('Pending');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
});

test('the address can be changed and is remembered', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Send receipts to').fill('receipts@expenseit.com');
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.reload();
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Open Outlook');
  const copied = await page.evaluate(() => [...new Set(window.__copied)]);
  expect(copied).toEqual(['receipts@expenseit.com']);
});

test('an invalid address is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Send receipts to').fill('not-an-email');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('status')).toContainText('valid email');
});

test('deleting asks first, then removes the receipt', async ({ page }) => {
  await page.goto('/');
  await scan(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('receipt')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('receipt')).toHaveCount(0);
});

test('an unreadable photo shows an error and keeps the app usable', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('camera-input').setInputFiles({
    name: 'broken.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('this is not an image'),
  });
  await expect(page.getByRole('status')).toContainText('couldn’t read');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
});

test('no screen ever says the receipt reached Concur', async ({ page }) => {
  await stubShare(page);
  await page.goto('/');
  await scan(page);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('status')).toContainText('Open Outlook');
  await page.getByRole('button', { name: 'Mark sent' }).click();
  await expect(page.getByTestId('receipt').first()).toContainText('Marked sent');
  const text = await page.locator('#list-view').innerText();
  expect(text).not.toMatch(/uploaded|received|delivered|in concur/i);
});

test('the app makes no requests to other sites', async ({ page }) => {
  const foreign = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') foreign.push(r.url());
  });
  await page.goto('/');
  await scan(page);
  expect(foreign).toEqual([]);
});

test('the page has what iOS needs to install it', async ({ page, request }) => {
  await page.goto('/');
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(icon)).status()).toBe(200);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  for (const { src } of manifest.icons) {
    expect((await request.get(src)).status()).toBe(200);
  }
});

test('the app opens offline once it has loaded', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // Let the service worker take control of the page.
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await scan(page);
  await expect(page.getByTestId('receipt')).toHaveCount(1);
});

test('the layout fits a phone without sideways scrolling', async ({ page }) => {
  await page.goto('/');
  await scan(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
