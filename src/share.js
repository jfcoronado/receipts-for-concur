// Sends a receipt through the system share sheet.

export const DEFAULT_ADDRESS = 'receipts@concur.com';

export const isValidEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

export function canShareFiles(nav, file) {
  try {
    return Boolean(nav.share && nav.canShare && nav.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

/** Starts the copy immediately and resolves to whether it worked. Never rejects. */
function copyText(nav, text) {
  try {
    return nav.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Copies the address and opens the share sheet.
 *
 * Safari only allows share() during the tap, so this must run directly from the
 * click handler, with nothing awaited before share() is called. The Web Share API
 * cannot set a recipient, which is why the address goes to the clipboard instead.
 *
 * Resolves to { outcome, copied, message }, where outcome is one of
 * 'shared', 'cancelled', 'unsupported' or 'failed'.
 */
export async function shareReceipt({ file, address, nav = navigator }) {
  if (!canShareFiles(nav, file)) return { outcome: 'unsupported', copied: false };

  const copying = copyText(nav, address);
  try {
    await nav.share({ files: [file] });
    return { outcome: 'shared', copied: await copying };
  } catch (error) {
    const copied = await copying;
    if (error.name === 'AbortError') return { outcome: 'cancelled', copied };
    return { outcome: 'failed', copied, message: `${error.name}: ${error.message}` };
  }
}
