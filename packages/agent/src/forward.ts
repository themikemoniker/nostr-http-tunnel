import {
  type TunnelRequest,
  createResponse,
  createErrorResponse,
  decodeBody,
  type TunnelResponseMessage,
} from '@nostr-http-tunnel/protocol';

export interface ForwardOptions {
  targetUrl: string;
  maxResponseSize: number;
}

/** Forward a tunnel request to the local HTTP service and return a tunnel response */
export async function forwardRequest(
  req: TunnelRequest,
  options: ForwardOptions,
): Promise<TunnelResponseMessage> {
  const url = new URL(req.path, options.targetUrl);
  const body = decodeBody(req.body);

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: body ? new Uint8Array(body) : undefined,
    });

    const responseBody = Buffer.from(await response.arrayBuffer());

    if (responseBody.length > options.maxResponseSize) {
      return createErrorResponse(
        req.id,
        502,
        `Response too large: ${responseBody.length} bytes exceeds limit of ${options.maxResponseSize}`,
      );
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return createResponse(req.id, response.status, headers, responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return createErrorResponse(req.id, 502, `Upstream error: ${message}`);
  }
}
