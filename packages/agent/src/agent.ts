import { generateSecretKey, getPublicKey, type Event } from 'nostr-tools/pure';
import { wrapEvent, unwrapEvent } from 'nostr-tools/nip17';
import * as nip19 from 'nostr-tools/nip19';
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
import {
  deserializeRequest,
  serialize,
} from '@nostr-http-tunnel/protocol';
import { RelayManager } from './relay.js';
import { forwardRequest, type ForwardOptions } from './forward.js';

export interface AgentConfig {
  privateKey?: string;     // hex-encoded private key
  targetUrl: string;       // e.g. http://localhost:8080
  relayUrls: string[];     // relay WebSocket URLs
  maxResponseSize: number; // max response body in bytes
}

export class TunnelAgent {
  private sk: Uint8Array;
  private pk: string;
  private relayManager: RelayManager;
  private forwardOptions: ForwardOptions;
  private processedEvents = new Set<string>();

  constructor(config: AgentConfig) {
    if (config.privateKey) {
      this.sk = hexToBytes(config.privateKey);
    } else {
      this.sk = generateSecretKey();
    }
    this.pk = getPublicKey(this.sk);

    this.forwardOptions = {
      targetUrl: config.targetUrl,
      maxResponseSize: config.maxResponseSize,
    };

    this.relayManager = new RelayManager({
      relayUrls: config.relayUrls,
      pubkey: this.pk,
      onEvent: (event) => this.handleEvent(event),
    });
  }

  get publicKey(): string {
    return this.pk;
  }

  get secretKeyHex(): string {
    return bytesToHex(this.sk);
  }

  get npub(): string {
    return nip19.npubEncode(this.pk);
  }

  /** Start the agent: connect to relays and begin processing requests */
  start(): void {
    console.log('=== Nostr HTTP Tunnel Agent ===');
    console.log(`Public key: ${this.pk}`);
    console.log(`npub:       ${this.npub}`);
    console.log(`Target:     ${this.forwardOptions.targetUrl}`);
    console.log(`Max size:   ${this.forwardOptions.maxResponseSize} bytes`);
    console.log('');
    this.relayManager.start();
    console.log('Agent is running. Waiting for requests...');
  }

  /** Stop the agent */
  stop(): void {
    this.relayManager.close();
    console.log('Agent stopped.');
  }

  private async handleEvent(event: Event): Promise<void> {
    // Deduplicate events (relays may deliver the same event)
    if (this.processedEvents.has(event.id)) return;
    this.processedEvents.add(event.id);

    // Prevent memory leak from growing Set
    if (this.processedEvents.size > 10000) {
      const entries = [...this.processedEvents];
      for (let i = 0; i < 5000; i++) {
        this.processedEvents.delete(entries[i]);
      }
    }

    try {
      // Unwrap the gift-wrapped DM
      const rumor = unwrapEvent(event, this.sk);
      const senderPubkey = rumor.pubkey;

      console.log(`[${new Date().toISOString()}] Request from ${senderPubkey.slice(0, 12)}...`);

      // Parse the tunnel request envelope from the DM content
      const tunnelRequest = deserializeRequest(rumor.content);
      console.log(`  ${tunnelRequest.method} ${tunnelRequest.path} (id: ${tunnelRequest.id.slice(0, 8)}...)`);

      // Forward to local service
      const tunnelResponse = await forwardRequest(tunnelRequest, this.forwardOptions);
      console.log(`  → ${tunnelResponse.status}`);

      // Wrap and send response back to the client
      const responsePayload = serialize(tunnelResponse);
      const wrappedResponse = wrapEvent(
        this.sk,
        { publicKey: senderPubkey },
        responsePayload,
      );

      await this.relayManager.publish(wrappedResponse);
      console.log(`  ✓ Response sent`);
    } catch (err) {
      console.error('Error handling event:', err instanceof Error ? err.message : err);
    }
  }
}
