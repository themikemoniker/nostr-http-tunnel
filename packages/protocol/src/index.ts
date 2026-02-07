export {
  PROTOCOL_VERSION,
  type HttpMethod,
  type TunnelRequest,
  type TunnelResponse,
  type TunnelErrorResponse,
  type TunnelResponseMessage,
  isErrorResponse,
} from './types.js';

export {
  createRequest,
  createResponse,
  createErrorResponse,
  serialize,
  deserializeRequest,
  deserializeResponse,
  decodeBody,
} from './envelope.js';

export { encodeBase64, decodeBase64 } from './base64.js';
