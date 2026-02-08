import { LightningWidget } from './widget.js';

if (!customElements.get('lightning-widget')) {
  customElements.define('lightning-widget', LightningWidget);
}

export { LightningWidget };
