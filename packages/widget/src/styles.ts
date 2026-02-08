export const WIDGET_CSS = `
:host {
  display: block;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
  line-height: 1.6;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Trigger button (collapsed state) */
.ln-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  font-size: 0.95rem;
  font-weight: 600;
  background: linear-gradient(135deg, #f7931a, #e8780a);
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 2px 12px rgba(247, 147, 26, 0.3);
  transition: transform 0.15s, box-shadow 0.2s;
}

.ln-trigger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(247, 147, 26, 0.4);
}

.ln-trigger:active { transform: translateY(0); }

.ln-trigger svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  stroke: none;
}

/* Card wrapper for expand/collapse */
.ln-card-wrapper {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.3s ease, opacity 0.2s ease, margin 0.3s ease;
  margin-top: 0;
}

.ln-card-wrapper.open {
  max-height: 800px;
  opacity: 1;
  margin-top: 0.75rem;
}

.ln-card {
  max-width: 400px;
  background: #16213e;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 1.5rem;
}

.ln-header {
  text-align: center;
  margin-bottom: 1.25rem;
}

.ln-header h2 {
  font-size: 1.4rem;
  margin-bottom: 0.15rem;
  color: #e0e0e0;
}

.ln-header p {
  font-size: 0.8rem;
  opacity: 0.8;
  margin-bottom: 0;
}

.ln-icon {
  width: 48px;
  height: 48px;
  color: #f7931a;
  margin-bottom: 0.25rem;
  filter: drop-shadow(0 0 8px rgba(247, 147, 26, 0.4));
}

/* BOLT toggle */
.ln-toggle {
  display: flex;
  background: #1a1a2e;
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 1rem;
}

.ln-toggle-btn {
  flex: 1;
  padding: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #e0e0e0;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
  font-family: inherit;
}

.ln-toggle-btn.active {
  background: #0f3460;
  opacity: 1;
}

/* Amount buttons */
.ln-amounts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ln-amt {
  padding: 0.5rem 0.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  background: #1a1a2e;
  color: #e0e0e0;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.ln-amt span {
  font-size: 0.65rem;
  font-weight: 400;
  opacity: 0.6;
}

.ln-amt:hover { border-color: #0f3460; }

.ln-amt.selected {
  border-color: #f7931a;
  background: rgba(247, 147, 26, 0.1);
  color: #f7931a;
}

.ln-custom { margin-bottom: 0.75rem; }

.ln-custom input {
  display: block;
  width: 100%;
  padding: 0.5rem;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  font-family: inherit;
}

.ln-desc {
  display: block;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.75rem;
  text-align: center;
  font-size: 0.85rem;
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  font-family: inherit;
}

/* Pay button */
.ln-pay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #f7931a, #e8780a);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.2s;
  box-shadow: 0 2px 12px rgba(247, 147, 26, 0.3);
  font-family: inherit;
}

.ln-pay-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(247, 147, 26, 0.4); }
.ln-pay-btn:active { transform: translateY(0); }
.ln-pay-btn:disabled { opacity: 0.5; cursor: wait; transform: none; }

.ln-pay-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: none;
}

.ln-bolt12-info {
  font-size: 0.8rem;
  text-align: center;
  opacity: 0.7;
  margin-bottom: 0.75rem;
}

/* Invoice result */
.ln-result {
  margin-top: 1.25rem;
  text-align: center;
}

.ln-qr {
  display: flex;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.ln-qr canvas {
  border-radius: 12px;
}

.ln-invoice-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  margin-bottom: 0.5rem;
}

.ln-invoice-text {
  flex: 1;
  background: #1a1a2e;
  padding: 0.5rem;
  border-radius: 8px;
  font-size: 0.6rem;
  word-break: break-all;
  text-align: left;
  max-height: 3.5rem;
  overflow-y: auto;
  font-family: monospace;
}

.ln-copy-btn {
  width: auto;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  flex-shrink: 0;
  border-radius: 8px;
  background: #0f3460;
  color: white;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.ln-info {
  font-size: 0.8rem;
  opacity: 0.7;
  white-space: pre-line;
}

.ln-error {
  margin-top: 1rem;
  color: #e74c3c;
}

.ln-error pre {
  font-size: 0.8rem;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid #e74c3c;
  padding: 0.5rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

[hidden] { display: none !important; }
`;
