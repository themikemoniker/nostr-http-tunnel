/** Protocol version */
export const PROTOCOL_VERSION = 1;

/** HTTP methods supported by the tunnel */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Request envelope: client → agent */
export interface TunnelRequest {
  v: number;
  id: string;
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body: string | null; // base64 encoded
}

/** Successful response envelope: agent → client */
export interface TunnelResponse {
  v: number;
  id: string;
  status: number;
  headers: Record<string, string>;
  body: string | null; // base64 encoded
}

/** Error response envelope: agent → client */
export interface TunnelErrorResponse {
  v: number;
  id: string;
  status: number;
  error: string;
}

/** Union of all response types */
export type TunnelResponseMessage = TunnelResponse | TunnelErrorResponse;

/** Check if a response is an error response */
export function isErrorResponse(msg: TunnelResponseMessage): msg is TunnelErrorResponse {
  return 'error' in msg;
}
