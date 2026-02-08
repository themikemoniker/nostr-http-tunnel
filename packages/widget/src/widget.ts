import { createTunnelClient, type TunnelClient } from '@nostr-http-tunnel/client';
import QRCode from 'qrcode';
import { WIDGET_CSS } from './styles.js';
import { buildTemplate } from './template.js';

const DEFAULT_AMOUNTS = [100, 500, 1000, 5000, 10000];

export class LightningWidget extends HTMLElement {
  static observedAttributes = ['npub', 'relays', 'amounts', 'title'];

  private shadow: ShadowRoot;
  private client: TunnelClient | null = null;
  private clientNpub = '';
  private clientRelays = '';
  private selectedSat = 0;
  private expanded = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  attributeChangedCallback() {
    if (this.shadow.children.length > 0) {
      this.render();
      this.bindEvents();
    }
  }

  private get npub(): string {
    return this.getAttribute('npub') || '';
  }

  private get relays(): string[] {
    const attr = this.getAttribute('relays') || 'wss://relay.damus.io,wss://nos.lol';
    return attr.split(',').map(r => r.trim()).filter(Boolean);
  }

  private get amounts(): number[] {
    const attr = this.getAttribute('amounts');
    if (!attr) return DEFAULT_AMOUNTS;
    return attr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);
  }

  private get widgetTitle(): string {
    return this.getAttribute('title') || 'Zap Me';
  }

  private render() {
    const amounts = this.amounts;
    this.selectedSat = amounts[Math.min(2, amounts.length - 1)] || 1000;

    this.shadow.innerHTML = `<style>${WIDGET_CSS}</style>${buildTemplate(this.widgetTitle, amounts)}`;

    // Mark default selected amount
    const btns = this.shadow.querySelectorAll<HTMLButtonElement>('.ln-amt');
    btns.forEach(b => b.classList.remove('selected'));
    const defaultBtn = this.shadow.querySelector<HTMLButtonElement>(`.ln-amt[data-sat="${this.selectedSat}"]`);
    if (defaultBtn) defaultBtn.classList.add('selected');
  }

  private getOrCreateClient(): TunnelClient {
    const npub = this.npub;
    const relays = this.relays;
    const relaysKey = relays.join(',');

    if (this.client && this.clientNpub === npub && this.clientRelays === relaysKey) {
      return this.client;
    }

    this.client?.close();
    this.client = createTunnelClient({ serviceNpub: npub, relays, timeout: 30_000 });
    this.clientNpub = npub;
    this.clientRelays = relaysKey;
    return this.client;
  }

  private $(sel: string) { return this.shadow.querySelector(sel); }
  private $$(sel: string) { return this.shadow.querySelectorAll(sel); }

  private showError(msg: string) {
    const el = this.$('.ln-error') as HTMLElement;
    const pre = this.$('.ln-error-msg') as HTMLPreElement;
    el.hidden = false;
    pre.textContent = msg;
  }

  private async showQR(data: string, infoLines: string[]) {
    const resultEl = this.$('.ln-result') as HTMLElement;
    const qrEl = this.$('.ln-qr') as HTMLElement;
    const textEl = this.$('.ln-invoice-text') as HTMLElement;
    const infoEl = this.$('.ln-info') as HTMLElement;

    qrEl.innerHTML = '';
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, data.toUpperCase(), {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrEl.appendChild(canvas);
    textEl.textContent = data;
    infoEl.textContent = infoLines.join('\n');
    resultEl.hidden = false;
  }

  private toggle() {
    this.expanded = !this.expanded;
    const wrapper = this.$('.ln-card-wrapper') as HTMLElement;
    wrapper.classList.toggle('open', this.expanded);
  }

  private bindEvents() {
    // Trigger button
    this.$('.ln-trigger')!.addEventListener('click', () => this.toggle());

    // Amount buttons
    this.$$('.ln-amt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.$$('.ln-amt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const val = (btn as HTMLElement).dataset.sat!;
        const customRow = this.$('.ln-custom') as HTMLElement;
        if (val === 'custom') {
          customRow.hidden = false;
          (this.$('.ln-custom-input') as HTMLInputElement).focus();
          this.selectedSat = 0;
        } else {
          customRow.hidden = true;
          this.selectedSat = parseInt(val, 10);
        }
      });
    });

    // BOLT toggle
    this.$$('.ln-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.$$('.ln-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = (btn as HTMLElement).dataset.mode;
        (this.$('.ln-bolt11-panel') as HTMLElement).hidden = mode !== 'bolt11';
        (this.$('.ln-bolt12-panel') as HTMLElement).hidden = mode !== 'bolt12';
        (this.$('.ln-result') as HTMLElement).hidden = true;
        (this.$('.ln-error') as HTMLElement).hidden = true;
      });
    });

    // Request BOLT11 invoice
    this.$('.ln-request-btn')!.addEventListener('click', () => this.requestInvoice());

    // Get BOLT12 offer
    this.$('.ln-offer-btn')!.addEventListener('click', () => this.getOffer());

    // Copy
    this.$('.ln-copy-btn')!.addEventListener('click', () => {
      const text = (this.$('.ln-invoice-text') as HTMLElement).textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        const btn = this.$('.ln-copy-btn') as HTMLButtonElement;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  }

  private async requestInvoice() {
    const resultEl = this.$('.ln-result') as HTMLElement;
    const errorEl = this.$('.ln-error') as HTMLElement;
    const btn = this.$('.ln-request-btn') as HTMLButtonElement;

    resultEl.hidden = true;
    errorEl.hidden = true;

    if (!this.npub) { this.showError('No npub configured'); return; }

    const amountSat = this.selectedSat || parseInt((this.$('.ln-custom-input') as HTMLInputElement).value, 10);
    if (!amountSat || amountSat < 1) { this.showError('Please select an amount'); return; }

    const description = (this.$('.ln-desc') as HTMLInputElement).value;

    btn.disabled = true;
    btn.textContent = 'Requesting...';

    try {
      const client = this.getOrCreateClient();
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

      await this.showQR(invoice, infoLines);

      this.dispatchEvent(new CustomEvent('invoice', { detail: data }));
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Request Invoice';
    }
  }

  private async getOffer() {
    const resultEl = this.$('.ln-result') as HTMLElement;
    const errorEl = this.$('.ln-error') as HTMLElement;
    const btn = this.$('.ln-offer-btn') as HTMLButtonElement;

    resultEl.hidden = true;
    errorEl.hidden = true;

    if (!this.npub) { this.showError('No npub configured'); return; }

    btn.disabled = true;
    btn.textContent = 'Fetching...';

    try {
      const client = this.getOrCreateClient();
      const res = await client.fetch('/getoffer', { method: 'GET' });

      if (res.error || res.status >= 400) {
        throw new Error(res.error || `HTTP ${res.status}: ${res.body}`);
      }

      const offer = res.body.replace(/^"|"$/g, '').trim();
      await this.showQR(offer, ['BOLT12 Offer']);

      this.dispatchEvent(new CustomEvent('offer', { detail: { offer } }));
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Get Offer';
    }
  }

  disconnectedCallback() {
    this.client?.close();
    this.client = null;
  }
}
