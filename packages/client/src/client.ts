import { SimplePool } from 'nostr-tools/pool';
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
import {
  createRequest,
  serialize,
  deserializeResponse,
  decodeBody,
  type HttpMethod,
  type TunnelResponseMessage,
  isErrorResponse,
} from '@nostr-http-tunnel/protocol';

export interface TunnelClientOptions {
  serviceNpub?: string;       // bech32 npub of the agent
  servicePubkey?: string;     // hex pubkey of the agent (alternative to npub)
  relays: string[];
  privateKey?: string;        // hex-encoded; auto-generates ephemeral key if omitted
  timeout?: number;           // request timeout in ms (default 30000)
}

export interface TunnelFetchOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
}

export interface TunnelFetchResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

export class TunnelClient {
  private pool: SimplePool;
  private sk: Uint8Array;
  private pk: string;
  private servicePk: string;
  private relays: string[];
  private timeout: number;

  constructor(options: TunnelClientOptions) {
    this.pool = new SimplePool();
    this.relays = options.relays;
    this.timeout = options.timeout ?? 30_000;

    // Resolve service pubkey
    if (options.servicePubkey) {
      this.servicePk = options.servicePubkey;
    } else if (options.serviceNpub) {
      const decoded = nip19.decode(options.serviceNpub);
      if (decoded.type !== 'npub') throw new Error('Invalid npub');
      this.servicePk = decoded.data;
    } else {
      throw new Error('Must provide serviceNpub or servicePubkey');
    }

    // Client keypair
    if (options.privateKey) {
      this.sk = hexToBytes(options.privateKey);
    } else {
      this.sk = generateSecretKey();
    }
    this.pk = getPublicKey(this.sk);
  }

  /** Send an HTTP request through the Nostr tunnel */
  async fetch(path: string, options: TunnelFetchOptions = {}): Promise<TunnelFetchResponse> {
    const method = options.method ?? 'GET';
    const headers = options.headers ?? {};
    const body = options.body ?? null;

    // Build the tunnel request envelope
    const tunnelReq = createRequest(method, path, headers, body);
    const requestId = tunnelReq.id;
    const payload = serialize(tunnelReq);

    // Wrap as NIP-17 DM and publish
    const wrappedEvent = wrapEvent(
      this.sk,
      { publicKey: this.servicePk },
      payload,
    );

    // Set up response listener before publishing
    const responsePromise = this.waitForResponse(requestId);

    await Promise.any(this.pool.publish(this.relays, wrappedEvent));

    return responsePromise;
  }

  private waitForResponse(requestId: string): Promise<TunnelFetchResponse> {
    return new Promise<TunnelFetchResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.close();
        reject(new Error(`Request ${requestId} timed out after ${this.timeout}ms`));
      }, this.timeout);

      const sub = this.pool.subscribe(
        this.relays,
        { kinds: [1059], '#p': [this.pk] },
        {
          onevent: (event: Event) => {
            try {
              const rumor = unwrapEvent(event, this.sk);
              const response: TunnelResponseMessage = deserializeResponse(rumor.content);

              if (response.id !== requestId) return; // not our response

              clearTimeout(timer);
              sub.close();

              if (isErrorResponse(response)) {
                resolve({
                  status: response.status,
                  headers: {},
                  body: '',
                  error: response.error,
                });
              } else {
                const bodyBuf = decodeBody(response.body);
                resolve({
                  status: response.status,
                  headers: response.headers,
                  body: bodyBuf ? new TextDecoder().decode(bodyBuf) : '',
                });
              }
            } catch {
              // Not a valid response for us, ignore
            }
          },
        },
      );
    });
  }

  /** Close all relay connections */
  close(): void {
    this.pool.close(this.relays);
  }
}

/** Convenience factory function */
export function createTunnelClient(options: TunnelClientOptions): TunnelClient {
  return new TunnelClient(options);
}
