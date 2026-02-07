import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { TunnelAgent } from '../packages/agent/dist/agent.js';
import { TunnelClient } from '../packages/client/dist/client.js';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];
const TEST_TIMEOUT = 60_000;

let httpServer: Server;
let httpPort: number;
let agent: TunnelAgent;
let client: TunnelClient;

before(async () => {
  // 1. Start a local echo HTTP server
  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const echo = JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body.toString('utf-8'),
      });
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-echo': 'true',
      });
      res.end(echo);
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      httpPort = typeof addr === 'object' && addr !== null ? addr.port : 0;
      console.log(`Echo server listening on port ${httpPort}`);
      resolve();
    });
  });

  // 2. Start the tunnel agent
  agent = new TunnelAgent({
    targetUrl: `http://localhost:${httpPort}`,
    relayUrls: RELAYS,
    maxResponseSize: 262144,
  });
  agent.start();

  // Give the agent a moment to connect to relays
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Create the tunnel client
  client = new TunnelClient({
    servicePubkey: agent.publicKey,
    relays: RELAYS,
    timeout: 30_000,
  });

  console.log(`Agent npub: ${agent.npub}`);
  console.log('Integration test setup complete.\n');
});

after(() => {
  client?.close();
  agent?.stop();
  httpServer?.close();
});

describe('end-to-end tunnel', { timeout: TEST_TIMEOUT }, () => {
  it('GET request round-trips through Nostr relays', async () => {
    console.log('  Sending GET /test/hello ...');
    const res = await client.fetch('/test/hello');

    assert.equal(res.status, 200);
    assert.ok(!res.error, `Unexpected error: ${res.error}`);

    const echo = JSON.parse(res.body);
    assert.equal(echo.method, 'GET');
    assert.equal(echo.url, '/test/hello');
    console.log('  GET round-trip OK');
  });

  it('POST with JSON body round-trips through Nostr relays', async () => {
    const payload = JSON.stringify({ event: 'trigger', value: 42 });
    console.log('  Sending POST /api/webhook ...');
    const res = await client.fetch('/api/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });

    assert.equal(res.status, 200);
    assert.ok(!res.error, `Unexpected error: ${res.error}`);

    const echo = JSON.parse(res.body);
    assert.equal(echo.method, 'POST');
    assert.equal(echo.url, '/api/webhook');

    const receivedBody = JSON.parse(echo.body);
    assert.equal(receivedBody.event, 'trigger');
    assert.equal(receivedBody.value, 42);
    console.log('  POST round-trip OK');
  });

  it('response headers are forwarded through the tunnel', async () => {
    console.log('  Checking response headers ...');
    const res = await client.fetch('/headers-check');

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-echo'], 'true');
    assert.equal(res.headers['content-type'], 'application/json');
    console.log('  Headers OK');
  });
});
