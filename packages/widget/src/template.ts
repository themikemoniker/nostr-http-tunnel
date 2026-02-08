const BOLT_ICON_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>';

export function buildAmountButtons(amounts: number[]): string {
  return amounts.map((sat, i) => {
    const label = sat >= 1000 ? `${sat / 1000}k` : String(sat);
    const selected = i === 2 ? ' selected' : '';
    return `<button type="button" class="ln-amt${selected}" data-sat="${sat}">${label} <span>sats</span></button>`;
  }).join('\n') + '\n<button type="button" class="ln-amt" data-sat="custom">Custom</button>';
}

export function buildTemplate(title: string, amounts: number[]): string {
  return `
<button type="button" class="ln-trigger">
  ${BOLT_ICON_FILLED}
  ${title}
</button>

<div class="ln-card-wrapper">
  <div class="ln-card">
    <div class="ln-header">
      <svg class="ln-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <h2>${title}</h2>
      <p>Send a Lightning payment through Nostr</p>
    </div>

    <div class="ln-toggle">
      <button type="button" class="ln-toggle-btn active" data-mode="bolt11">BOLT11</button>
      <button type="button" class="ln-toggle-btn" data-mode="bolt12">BOLT12</button>
    </div>

    <div class="ln-bolt11-panel">
      <div class="ln-amounts">
        ${buildAmountButtons(amounts)}
      </div>

      <div class="ln-custom" hidden>
        <input type="number" class="ln-custom-input" min="1" placeholder="Amount in sats" />
      </div>

      <input type="text" class="ln-desc" value="Nostr tunnel payment" placeholder="Message (optional)" />

      <button type="button" class="ln-pay-btn ln-request-btn">
        ${BOLT_ICON_FILLED}
        Request Invoice
      </button>
    </div>

    <div class="ln-bolt12-panel" hidden>
      <p class="ln-bolt12-info">Get the BOLT12 offer for this node. Paste it into a compatible wallet to pay any amount.</p>
      <button type="button" class="ln-pay-btn ln-offer-btn">
        ${BOLT_ICON_FILLED}
        Get Offer
      </button>
    </div>

    <div class="ln-result" hidden>
      <div class="ln-qr"></div>
      <div class="ln-invoice-row">
        <code class="ln-invoice-text"></code>
        <button type="button" class="ln-copy-btn">Copy</button>
      </div>
      <div class="ln-info"></div>
    </div>

    <div class="ln-error" hidden>
      <pre class="ln-error-msg"></pre>
    </div>
  </div>
</div>`;
}
