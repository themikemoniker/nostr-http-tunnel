import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequest } from '@nostr-http-tunnel/protocol';
import { forwardRequest } from './forward.js';
import { isErrorResponse } from '@nostr-http-tunnel/protocol';

let server: Server;
let port: number;

before(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      // Echo back request details as JSON
      const echo = JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body.toString('utf-8'),
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(echo);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

describe('forwardRequest', () => {
  it('forwards a GET request and returns the response', async () => {
    const req = createRequest('GET', '/hello');
    const res = await forwardRequest(req, {
      targetUrl: `http://localhost:${port}`,
      maxResponseSize: 262144,
    });

    assert.equal(res.status, 200);
    assert.ok(!isErrorResponse(res));
    if (!isErrorResponse(res)) {
      assert.ok(res.body);
      const decoded = JSON.parse(Buffer.from(res.body, 'base64').toString('utf-8'));
      assert.equal(decoded.method, 'GET');
      assert.equal(decoded.url, '/hello');
    }
  });

  it('forwards a POST with JSON body', async () => {
    const payload = JSON.stringify({ key: 'value', num: 42 });
    const req = createRequest('POST', '/api/data', { 'content-type': 'application/json' }, payload);
    const res = await forwardRequest(req, {
      targetUrl: `http://localhost:${port}`,
      maxResponseSize: 262144,
    });

    assert.equal(res.status, 200);
    assert.ok(!isErrorResponse(res));
    if (!isErrorResponse(res)) {
      assert.ok(res.body);
      const decoded = JSON.parse(Buffer.from(res.body, 'base64').toString('utf-8'));
      assert.equal(decoded.method, 'POST');
      assert.equal(decoded.url, '/api/data');
      const receivedBody = JSON.parse(decoded.body);
      assert.equal(receivedBody.key, 'value');
      assert.equal(receivedBody.num, 42);
    }
  });

  it('returns 502 when upstream connection is refused', async () => {
    const req = createRequest('GET', '/');
    const res = await forwardRequest(req, {
      targetUrl: 'http://localhost:1', // port 1 should be refused
      maxResponseSize: 262144,
    });

    assert.equal(res.status, 502);
    assert.ok(isErrorResponse(res));
    if (isErrorResponse(res)) {
      assert.match(res.error, /Upstream error/);
    }
  });

  it('returns 502 when response exceeds maxResponseSize', async () => {
    const req = createRequest('GET', '/big');
    const res = await forwardRequest(req, {
      targetUrl: `http://localhost:${port}`,
      maxResponseSize: 10, // tiny limit — the echo response will exceed this
    });

    assert.equal(res.status, 502);
    assert.ok(isErrorResponse(res));
    if (isErrorResponse(res)) {
      assert.match(res.error, /Response too large/);
    }
  });
});
