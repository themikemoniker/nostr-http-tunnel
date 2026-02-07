import {
  PROTOCOL_VERSION,
  type HttpMethod,
  type TunnelRequest,
  type TunnelResponse,
  type TunnelErrorResponse,
  type TunnelResponseMessage,
} from './types.js';
import { encodeBase64, decodeBase64 } from './base64.js';

const encoder = new TextEncoder();

/** Generate a UUID v4, using crypto.randomUUID when available */
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Create a tunnel request envelope */
export function createRequest(
  method: HttpMethod,
  path: string,
  headers: Record<string, string> = {},
  body?: string | Uint8Array | null,
): TunnelRequest {
  let encodedBody: string | null = null;
  if (body != null) {
    if (body instanceof Uint8Array) {
      encodedBody = encodeBase64(body);
    } else {
      encodedBody = encodeBase64(encoder.encode(body));
    }
  }

  return {
    v: PROTOCOL_VERSION,
    id: generateId(),
    method,
    path: path.startsWith('/') ? path : `/${path}`,
    headers,
    body: encodedBody,
  };
}

/** Create a tunnel response envelope */
export function createResponse(
  requestId: string,
  status: number,
  headers: Record<string, string>,
  body?: Uint8Array | null,
): TunnelResponse {
  return {
    v: PROTOCOL_VERSION,
    id: requestId,
    status,
    headers,
    body: body ? encodeBase64(body) : null,
  };
}

/** Create a tunnel error response envelope */
export function createErrorResponse(
  requestId: string,
  status: number,
  error: string,
): TunnelErrorResponse {
  return {
    v: PROTOCOL_VERSION,
    id: requestId,
    status,
    error,
  };
}

/** Serialize an envelope to JSON string */
export function serialize(envelope: TunnelRequest | TunnelResponseMessage): string {
  return JSON.stringify(envelope);
}

/** Deserialize a JSON string to a tunnel request */
export function deserializeRequest(json: string): TunnelRequest {
  const parsed = JSON.parse(json);
  validateRequest(parsed);
  return parsed;
}

/** Deserialize a JSON string to a tunnel response */
export function deserializeResponse(json: string): TunnelResponseMessage {
  const parsed = JSON.parse(json);
  validateResponse(parsed);
  return parsed;
}

/** Decode a base64-encoded body to a Uint8Array */
export function decodeBody(body: string | null): Uint8Array | null {
  if (body == null) return null;
  return decodeBase64(body);
}

function validateRequest(obj: unknown): asserts obj is TunnelRequest {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Invalid request: not an object');
  }
  const req = obj as Record<string, unknown>;
  if (typeof req.v !== 'number') throw new Error('Invalid request: missing version');
  if (typeof req.id !== 'string') throw new Error('Invalid request: missing id');
  if (typeof req.method !== 'string') throw new Error('Invalid request: missing method');
  if (typeof req.path !== 'string') throw new Error('Invalid request: missing path');
  if (typeof req.headers !== 'object' || req.headers === null) {
    throw new Error('Invalid request: missing headers');
  }
}

function validateResponse(obj: unknown): asserts obj is TunnelResponseMessage {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Invalid response: not an object');
  }
  const res = obj as Record<string, unknown>;
  if (typeof res.v !== 'number') throw new Error('Invalid response: missing version');
  if (typeof res.id !== 'string') throw new Error('Invalid response: missing id');
  if (typeof res.status !== 'number') throw new Error('Invalid response: missing status');
}
