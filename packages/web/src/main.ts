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
const responseRendered = document.getElementById('response-rendered') as HTMLIFrameElement;
const errorMessage = document.getElementById('error-message') as HTMLPreElement;
const btnRendered = document.getElementById('btn-rendered') as HTMLButtonElement;
const btnRaw = document.getElementById('btn-raw') as HTMLButtonElement;
const pathInput = document.getElementById('path') as HTMLInputElement;

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

// View toggle
let viewMode: 'rendered' | 'raw' = 'rendered';

btnRendered.addEventListener('click', () => {
  viewMode = 'rendered';
  btnRendered.classList.add('active');
  btnRaw.classList.remove('active');
  responseRendered.hidden = false;
  responseBody.hidden = true;
});

btnRaw.addEventListener('click', () => {
  viewMode = 'raw';
  btnRaw.classList.add('active');
  btnRendered.classList.remove('active');
  responseBody.hidden = false;
  responseRendered.hidden = true;
});

/** Check if response content-type looks like HTML */
function isHtmlResponse(headers: Record<string, string>): boolean {
  const ct = headers['content-type'] || '';
  return ct.includes('text/html');
}

/** Navigate the tunnel: fetch a path and display the result */
async function tunnelNavigate(path: string): Promise<void> {
  responseSection.hidden = true;
  errorSection.hidden = true;
  pathInput.value = path;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  const npub = (document.getElementById('npub') as HTMLInputElement).value.trim();
  const relaysRaw = (document.getElementById('relays') as HTMLInputElement).value;
  const relays = relaysRaw.split(',').map(r => r.trim()).filter(Boolean);

  try {
    const client = getOrCreateClient(npub, relays);
    const res: TunnelFetchResponse = await client.fetch(path, { method: 'GET', headers: {} });
    displayResponse(res);
  } catch (err) {
    errorSection.hidden = false;
    errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Request';
  }
}

/** Display a tunnel response */
function displayResponse(res: TunnelFetchResponse): void {
  responseSection.hidden = false;
  statusLine.textContent = `Status: ${res.status}`;
  statusLine.className = res.status < 400 ? 'status-ok' : 'status-error';
  responseHeaders.textContent = JSON.stringify(res.headers, null, 2);

  if (res.error) {
    responseBody.textContent = `Error: ${res.error}`;
    responseRendered.srcdoc = `<pre>${res.error}</pre>`;
    return;
  }

  // Raw view
  try {
    responseBody.textContent = JSON.stringify(JSON.parse(res.body), null, 2);
  } catch {
    responseBody.textContent = res.body;
  }

  // Rendered view
  if (isHtmlResponse(res.headers)) {
    responseRendered.srcdoc = res.body;
    // After iframe loads, intercept link clicks
    responseRendered.onload = () => interceptLinks(responseRendered);
    // Auto-switch to rendered for HTML
    if (viewMode === 'raw') {
      btnRendered.click();
    }
  } else {
    responseRendered.srcdoc = `<pre style="margin:1rem;font-family:monospace;white-space:pre-wrap">${escapeHtml(responseBody.textContent || '')}</pre>`;
  }

  // Show correct view
  responseRendered.hidden = viewMode !== 'rendered';
  responseBody.hidden = viewMode !== 'raw';
}

/** Intercept link clicks inside the iframe to tunnel them */
function interceptLinks(iframe: HTMLIFrameElement): void {
  const doc = iframe.contentDocument;
  if (!doc) return;

  doc.addEventListener('click', (e: MouseEvent) => {
    const anchor = (e.target as Element).closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip external links, mailto, javascript, anchors
    if (href.startsWith('http://') || href.startsWith('https://') ||
        href.startsWith('mailto:') || href.startsWith('javascript:') ||
        href.startsWith('#')) {
      return;
    }

    e.preventDefault();

    // Resolve relative paths
    const currentPath = pathInput.value;
    let newPath: string;
    if (href.startsWith('/')) {
      newPath = href;
    } else {
      const base = currentPath.endsWith('/') ? currentPath : currentPath.replace(/\/[^/]*$/, '/');
      newPath = base + href;
    }

    tunnelNavigate(newPath);
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Form submit handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  responseSection.hidden = true;
  errorSection.hidden = true;

  const npub = (document.getElementById('npub') as HTMLInputElement).value.trim();
  const relaysRaw = (document.getElementById('relays') as HTMLInputElement).value;
  const relays = relaysRaw.split(',').map(r => r.trim()).filter(Boolean);
  const method = (document.getElementById('method') as HTMLSelectElement).value as HttpMethod;
  const path = pathInput.value.trim() || '/';
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
    displayResponse(res);
  } catch (err) {
    errorSection.hidden = false;
    errorMessage.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Request';
  }
});
