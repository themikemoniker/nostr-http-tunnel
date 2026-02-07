import { createTunnelClient, type TunnelClient, type TunnelFetchResponse } from '@nostr-http-tunnel/client';
import type { HttpMethod } from '@nostr-http-tunnel/protocol';
import './style.css';

const form = document.getElementById('tunnel-form') as HTMLFormElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const responseSection = document.getElementById('response-section') as HTMLElement;
const errorSection = document.getElementById('error-section') as HTMLElement;
const statusLine = document.getElementById('status-line') as HTMLElement;
const responseHeaders = document.getElementById('response-headers') as HTMLPreElement;
const responseBody = document.getElementById('response-body') as HTMLPreElement;
const errorMessage = document.getElementById('error-message') as HTMLPreElement;

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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  responseSection.hidden = true;
  errorSection.hidden = true;

  const npub = (document.getElementById('npub') as HTMLInputElement).value.trim();
  const relaysRaw = (document.getElementById('relays') as HTMLInputElement).value;
  const relays = relaysRaw.split(',').map(r => r.trim()).filter(Boolean);
  const method = (document.getElementById('method') as HTMLSelectElement).value as HttpMethod;
  const path = (document.getElementById('path') as HTMLInputElement).value.trim() || '/';
  const headersRaw = (document.getElementById('headers') as HTMLTextAreaElement).value.trim();
  const body = (document.getElementById('body') as HTMLTextAreaElement).value || undefined;

  let headers: Record<string, string> = {};
  if (headersRaw) {
    try {
      headers = JSON.parse(headersRaw);
    } catch {
      errorSection.hidden = false;
      errorMessage.textContent = 'Invalid JSON in headers field';
      return;
    }
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const client = getOrCreateClient(npub, relays);
    const res: TunnelFetchResponse = await client.fetch(path, { method, headers, body });

    responseSection.hidden = false;
    statusLine.textContent = `Status: ${res.status}`;
    statusLine.className = res.status < 400 ? 'status-ok' : 'status-error';
    responseHeaders.textContent = JSON.stringify(res.headers, null, 2);

    if (res.error) {
      responseBody.textContent = `Error: ${res.error}`;
    } else {
      try {
        responseBody.textContent = JSON.stringify(JSON.parse(res.body), null, 2);
      } catch {
        responseBody.textContent = res.body;
      }
    }
  } catch (err) {
    errorSection.hidden = false;
    errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Request';
  }
});
