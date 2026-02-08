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

const requestBtn = document.getElementById('request-btn') as HTMLButtonElement;
const invoiceSection = document.getElementById('invoice-section') as HTMLElement;
const errorSection = document.getElementById('error-section') as HTMLElement;
const errorMessage = document.getElementById('error-message') as HTMLPreElement;
const qrContainer = document.getElementById('qr-container') as HTMLElement;
const invoiceString = document.getElementById('invoice-string') as HTMLElement;
const invoiceInfo = document.getElementById('invoice-info') as HTMLElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;

let currentClient: TunnelClient | null = null;
let lastNpub = '';
let lastRelays = '';

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

requestBtn.addEventListener('click', async () => {
  invoiceSection.hidden = true;
  errorSection.hidden = true;

  const npub = (document.getElementById('npub') as HTMLInputElement).value.trim();
  const relaysRaw = (document.getElementById('relays') as HTMLInputElement).value;
  const relays = relaysRaw.split(',').map(r => r.trim()).filter(Boolean);
  const amountSat = (document.getElementById('amount') as HTMLInputElement).value;
  const description = (document.getElementById('description') as HTMLInputElement).value;

  if (!npub) {
    errorSection.hidden = false;
    errorMessage.textContent = 'Please enter the agent npub';
    return;
  }

  requestBtn.disabled = true;
  requestBtn.textContent = 'Requesting...';

  try {
    const client = getOrCreateClient(npub, relays);

    // Call phoenixd createinvoice API through the tunnel
    const params = new URLSearchParams();
    params.set('description', description);
    params.set('amountSat', amountSat);

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

    // Display QR code
    qrContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, invoice.toUpperCase(), {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrContainer.appendChild(canvas);

    // Display invoice string
    invoiceString.textContent = invoice;

    // Display info
    const infoLines: string[] = [];
    if (data.amountSat) infoLines.push(`Amount: ${data.amountSat} sats`);
    if (data.description) infoLines.push(`Description: ${data.description}`);
    if (data.paymentHash) infoLines.push(`Payment hash: ${data.paymentHash}`);
    invoiceInfo.textContent = infoLines.join('\n');

    invoiceSection.hidden = false;
  } catch (err) {
    errorSection.hidden = false;
    errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    requestBtn.disabled = false;
    requestBtn.textContent = 'Request Invoice';
  }
});

// Copy invoice to clipboard
copyBtn.addEventListener('click', () => {
  const text = invoiceString.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });
});
