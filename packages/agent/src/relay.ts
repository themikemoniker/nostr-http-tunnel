import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import { type Event } from 'nostr-tools/pure';
import WebSocket from 'ws';

useWebSocketImplementation(WebSocket);

export interface RelayManagerOptions {
  relayUrls: string[];
  pubkey: string;
  onEvent: (event: Event) => void;
}

export class RelayManager {
  private pool: SimplePool;
  private relayUrls: string[];
  private sub: ReturnType<SimplePool['subscribe']> | null = null;

  constructor(private options: RelayManagerOptions) {
    this.pool = new SimplePool();
    this.relayUrls = options.relayUrls;
  }

  /** Start subscribing to gift-wrapped DMs (kind 1059) for our pubkey */
  start(): void {
    console.log(`Subscribing to ${this.relayUrls.length} relay(s) for kind 1059 events...`);

    this.sub = this.pool.subscribe(
      this.relayUrls,
      { kinds: [1059], '#p': [this.options.pubkey] },
      {
        onevent: (event: Event) => {
          this.options.onEvent(event);
        },
        oneose: () => {
          console.log('Caught up with stored events from relays.');
        },
      },
    );
  }

  /** Publish a gift-wrapped event to all relays */
  async publish(event: Event): Promise<void> {
    await Promise.any(this.pool.publish(this.relayUrls, event));
  }

  /** Close all connections */
  close(): void {
    if (this.sub) {
      this.sub.close();
      this.sub = null;
    }
    this.pool.close(this.relayUrls);
  }
}
