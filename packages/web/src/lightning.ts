import { createTunnelClient, type TunnelClient } from '@nostr-http-tunnel/client';
import QRCode from 'qrcode';
import { loadConfig } from './config.js';
import './style.css';

// Load config and pre-fill form
loadConfig().then(config => {
  if (config.npub) {
    (document.getElementById('npub') as HTMLInputElement).value = config.npub;
  }
  if (config.relays.length) {
    (document.getElementById('relays') as HTMLInputElement).value = config.relays.join(', ');
  }
});

// Elements
const requestBtn = document.getElementById('request-btn') as HTMLButtonElement;
const offerBtn = document.getElementById('offer-btn') as HTMLButtonElement;
const invoiceSection = document.getElementById('invoice-section') as HTMLElement;
const errorSection = document.getElementById('error-section') as HTMLElement;
const errorMessage = document.getElementById('error-message') as HTMLPreElement;
const qrContainer = document.getElementById('qr-container') as HTMLElement;
const invoiceString = document.getElementById('invoice-string') as HTMLElement;
const invoiceInfo = document.getElementById('invoice-info') as HTMLElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const bolt11Panel = document.getElementById('bolt11-panel') as HTMLElement;
const bolt12Panel = document.getElementById('bolt12-panel') as HTMLElement;
const customAmountRow = document.getElementById('custom-amount-row') as HTMLElement;
const customAmountInput = document.getElementById('custom-amount') as HTMLInputElement;

let currentClient: TunnelClient | null = null;
let lastNpub = '';
let lastRelays = '';
let selectedSat = 1000;

function getOrCreateClient(npub: string, relays: string[]): TunnelClient {
  const relaysKey = relays.join(',');
  if (currentClient && lastNpub === npub && lastRelays === relaysKey) {
    return currentClient;
  }
  currentClient?.close();
  currentClient = createTunnelClient({
    serviceNpub: npub,
    relays,
    timeout: 30_000,
  });
  lastNpub = npub;
  lastRelays = relaysKey;
  return currentClient;
}

function getConnectionParams() {
  const npub = (document.getElementById('npub') as HTMLInputElement).value.trim();
  const relaysRaw = (document.getElementById('relays') as HTMLInputElement).value;
  const relays = relaysRaw.split(',').map(r => r.trim()).filter(Boolean);
  return { npub, relays };
}

function showError(msg: string) {
  errorSection.hidden = false;
  errorMessage.textContent = msg;
}

async function showQR(data: string, infoLines: string[]) {
  qrContainer.innerHTML = '';
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, data.toUpperCase(), {
    width: 240,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  qrContainer.appendChild(canvas);
  invoiceString.textContent = data;
  invoiceInfo.textContent = infoLines.join('\n');
  invoiceSection.hidden = false;
}

// Amount preset buttons
document.querySelectorAll('.ln-amt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ln-amt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const val = (btn as HTMLElement).dataset.sat!;
    if (val === 'custom') {
      customAmountRow.hidden = false;
      customAmountInput.focus();
      selectedSat = 0;
    } else {
      customAmountRow.hidden = true;
      selectedSat = parseInt(val, 10);
    }
  });
});

// BOLT11 / BOLT12 toggle
document.querySelectorAll('.ln-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ln-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = (btn as HTMLElement).dataset.mode;
    bolt11Panel.hidden = mode !== 'bolt11';
    bolt12Panel.hidden = mode !== 'bolt12';
    invoiceSection.hidden = true;
    errorSection.hidden = true;
  });
});

// Request BOLT11 invoice
requestBtn.addEventListener('click', async () => {
  invoiceSection.hidden = true;
  errorSection.hidden = true;

  const { npub, relays } = getConnectionParams();
  if (!npub) { showError('Please enter the agent npub'); return; }

  const amountSat = selectedSat || parseInt(customAmountInput.value, 10);
  if (!amountSat || amountSat < 1) { showError('Please enter a valid amount'); return; }

  const description = (document.getElementById('description') as HTMLInputElement).value;

  requestBtn.disabled = true;
  requestBtn.textContent = 'Requesting...';

  try {
    const client = getOrCreateClient(npub, relays);
    const params = new URLSearchParams();
    params.set('amountSat', String(amountSat));
    params.set('description', description);

    const res = await client.fetch('/createinvoice', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (res.error || res.status >= 400) {
      throw new Error(res.error || `HTTP ${res.status}: ${res.body}`);
    }

    const data = JSON.parse(res.body);
    const invoice: string = data.serialized || data.invoice || data.paymentRequest || res.body;

    const infoLines: string[] = [];
    if (data.amountSat) infoLines.push(`${data.amountSat} sats`);
    if (data.paymentHash) infoLines.push(`Hash: ${data.paymentHash.slice(0, 16)}...`);

    await showQR(invoice, infoLines);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    requestBtn.disabled = false;
    requestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Request Invoice';
  }
});

// Get BOLT12 offer
offerBtn.addEventListener('click', async () => {
  invoiceSection.hidden = true;
  errorSection.hidden = true;

  const { npub, relays } = getConnectionParams();
  if (!npub) { showError('Please enter the agent npub'); return; }

  offerBtn.disabled = true;
  offerBtn.textContent = 'Fetching...';

  try {
    const client = getOrCreateClient(npub, relays);
    const res = await client.fetch('/getoffer', { method: 'GET' });

    if (res.error || res.status >= 400) {
      throw new Error(res.error || `HTTP ${res.status}: ${res.body}`);
    }

    // getoffer returns the offer string directly (not JSON)
    const offer = res.body.replace(/^"|"$/g, '').trim();
    await showQR(offer, ['BOLT12 Offer']);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    offerBtn.disabled = false;
    offerBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Get Offer';
  }
});

// Copy
copyBtn.addEventListener('click', () => {
  const text = invoiceString.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });
});
