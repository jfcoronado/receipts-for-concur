// Connects the screens to the queue, the editor and the share flow.

import { createEditor } from './editor.js';
import { createQueue } from './queue.js';
import { DEFAULT_ADDRESS, isValidEmail, shareReceipt } from './share.js';
import { openStore } from './store.js';

const ADDRESS_KEY = 'receipts.address';

const $ = (id) => document.getElementById(id);

const listView = $('list-view');
const editorView = $('editor-view');
const statusBox = $('status');

let queue;
let items = [];
let thumbnailUrls = [];
let statusTimer;

function say(message) {
  statusBox.textContent = message;
  statusBox.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusBox.classList.remove('visible'), 6000);
}

// Browser storage can throw in private windows, so the address falls back to the default.
function loadAddress() {
  try {
    return localStorage.getItem(ADDRESS_KEY) || DEFAULT_ADDRESS;
  } catch {
    return DEFAULT_ADDRESS;
  }
}

function saveAddress(address) {
  try {
    localStorage.setItem(ADDRESS_KEY, address);
    return true;
  } catch {
    return false;
  }
}

function showAddress(address) {
  $('address').value = address;
  $('address-hint').textContent = address;
}

const formatTime = (ms) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function button(label, className, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  if (className) el.className = className;
  el.addEventListener('click', onClick);
  return el;
}

function offerDownload(row, item, url) {
  if (row.querySelector('a')) return;
  const link = document.createElement('a');
  link.className = 'button';
  link.textContent = 'Download';
  link.href = url;
  link.download = item.name;
  row.querySelector('.actions').prepend(link);
}

/**
 * Handles the Send tap. Nothing may be awaited before shareReceipt, because Safari
 * only allows sharing during the tap. That is why receipts stay loaded in `items`
 * rather than being fetched from storage here.
 */
async function send(item, row, url) {
  const file = new File([item.blob], item.name, { type: 'image/jpeg' });
  const result = await shareReceipt({ file, address: loadAddress() });

  if (result.outcome === 'shared') {
    await queue.markShared(item.id);
    await render();
    say('Shared. Check Available Receipts in Concur to confirm it arrived.');
  } else if (result.outcome === 'cancelled') {
    say('Not sent. The receipt is still pending.');
  } else if (result.outcome === 'unsupported') {
    offerDownload(row, item, url);
    say('This browser can’t share files. Download the receipt and email it yourself.');
  } else {
    say(`Couldn’t open the share sheet. ${result.message}`);
  }
}

async function remove(item) {
  if (!confirm(`Delete ${item.name}? This can’t be undone.`)) return;
  await queue.remove(item.id);
  await render();
}

function openPreview(url) {
  $('preview-image').src = url;
  $('preview').showModal();
}

function receiptRow(item) {
  const url = URL.createObjectURL(item.blob);
  thumbnailUrls.push(url);

  const row = document.createElement('li');
  row.className = 'receipt';
  row.dataset.testid = 'receipt';

  const thumb = button('', 'thumb', () => openPreview(url));
  thumb.setAttribute('aria-label', `View ${item.name}`);
  const img = document.createElement('img');
  img.src = url;
  img.alt = `Receipt scanned ${formatTime(item.createdAt)}`;
  thumb.append(img);

  const details = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name;

  const pending = item.status === 'pending';
  const state = document.createElement('div');
  state.className = pending ? 'state pending' : 'state';
  state.textContent = pending ? 'Pending' : `Shared ${formatTime(item.sharedAt)}`;

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(
    button(pending ? 'Send' : 'Send again', pending ? 'primary' : '', () =>
      send(item, row, url).catch((error) => say(`Something went wrong. ${error.message}`)),
    ),
    button('Delete', 'danger', () =>
      remove(item).catch((error) => say(`Couldn’t delete it. ${error.message}`)),
    ),
  );

  details.append(name, state, actions);
  row.append(thumb, details);
  return row;
}

async function render() {
  items = await queue.list();
  thumbnailUrls.forEach((url) => URL.revokeObjectURL(url));
  thumbnailUrls = [];
  $('receipts').replaceChildren(...items.map(receiptRow));
  $('empty').hidden = items.length > 0;
}

function showEditor(visible) {
  editorView.hidden = !visible;
  listView.hidden = visible;
  scrollTo(0, 0);
}

function setUpEditor() {
  const editor = createEditor($('stage'));

  for (const input of document.querySelectorAll('.file-input')) {
    input.addEventListener('change', async () => {
      const [file] = input.files;
      input.value = ''; // Lets the same photo be chosen twice.
      if (!file) return;
      try {
        await editor.open(file);
        showEditor(true);
        editor.show();
      } catch {
        say('Sorry, we couldn’t read that photo. Try taking it again.');
      }
    });
  }

  $('rotate').addEventListener('click', () => editor.rotate());

  $('cancel-edit').addEventListener('click', () => {
    editor.close();
    showEditor(false);
  });

  $('save-edit').addEventListener('click', async () => {
    const save = $('save-edit');
    save.disabled = true;
    try {
      const blob = await editor.render({ enhanced: $('enhance').checked });
      await queue.add(blob);
      await render();
      editor.close();
      showEditor(false);
    } catch (error) {
      say(`Couldn’t save the receipt. ${error.message}`);
    } finally {
      save.disabled = false;
    }
  });
}

function setUpSettings() {
  $('open-settings').addEventListener('click', () => {
    $('settings').hidden = !$('settings').hidden;
  });

  $('save-address').addEventListener('click', () => {
    const address = $('address').value.trim();
    if (!isValidEmail(address)) {
      say('Enter a valid email address.');
      return;
    }
    say(saveAddress(address) ? 'Address saved.' : 'Couldn’t save the address on this device.');
    showAddress(address);
    $('settings').hidden = true;
  });
}

function setUpInstallHint() {
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = navigator.standalone === true;
  $('install-hint').hidden = !iPhone || installed;
}

async function start() {
  showAddress(loadAddress());
  setUpSettings();
  setUpInstallHint();
  setUpEditor();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('sw.js')
      .catch((error) => console.warn('Offline support unavailable', error));
  }

  queue = createQueue(await openStore());
  await render();
}

start().catch((error) => say(`The app couldn’t start. ${error.message}`));
