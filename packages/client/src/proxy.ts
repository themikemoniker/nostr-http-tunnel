#!/usr/bin/env node

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { TunnelClient, type TunnelFetchOptions } from './client.js';
import type { HttpMethod } from '@nostr-http-tunnel/protocol';

function parseArgs(): { npub?: string; pubkey?: string; relays: string[]; port: number; privateKey?: string; timeout?: number } {
  const args = process.argv.slice(2);
  const result: { npub?: string; pubkey?: string; relays: string[]; port: number; privateKey?: string; timeout?: number } = {
    relays: [],
    port: 3000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--npub':
        result.npub = args[++i];
        break;
      case '--pubkey':
        result.pubkey = args[++i];
        break;
      case '--relays':
        result.relays = args[++i].split(',').map((r) => r.trim()).filter(Boolean);
        break;
      case '--port':
        result.port = parseInt(args[++i], 10);
        break;
      case '--key':
        result.privateKey = args[++i];
        break;
      case '--timeout':
        result.timeout = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`Usage: nostr-tunnel-proxy [options]

Options:
  --npub <npub>       Agent's npub (bech32)
  --pubkey <hex>      Agent's public key (hex, alternative to --npub)
  --relays <urls>     Comma-separated relay URLs
  --port <port>       Local proxy port (default: 3000)
  --key <hex>         Client private key (hex, optional)
  --timeout <ms>      Request timeout in ms (default: 30000)
  --help              Show this help message

Environment variables:
  SERVICE_NPUB        Agent's npub
  RELAY_URLS          Comma-separated relay URLs
  PROXY_PORT          Local proxy port
  NOSTR_PRIVATE_KEY   Client private key (hex)
  REQUEST_TIMEOUT     Request timeout in ms`);
        process.exit(0);
    }
  }

  return result;
}

async function collectBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const buf = Buffer.concat(chunks);
  return buf.length > 0 ? buf.toString('utf-8') : undefined;
}

function main(): void {
  const args = parseArgs();

  const npub = args.npub ?? process.env.SERVICE_NPUB;
  const pubkey = args.pubkey ?? process.env.SERVICE_PUBKEY;
  const relays = args.relays.length > 0
    ? args.relays
    : (process.env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol').split(',').map((r) => r.trim()).filter(Boolean);
  const port = args.port ?? parseInt(process.env.PROXY_PORT ?? '3000', 10);
  const privateKey = args.privateKey ?? process.env.NOSTR_PRIVATE_KEY;
  const timeout = args.timeout ?? parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10);

  if (!npub && !pubkey) {
    console.error('Error: Must provide --npub or --pubkey (or SERVICE_NPUB / SERVICE_PUBKEY env var)');
    process.exit(1);
  }

  const client = new TunnelClient({
    serviceNpub: npub,
    servicePubkey: pubkey,
    relays,
    privateKey,
    timeout,
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = req.url ?? '/';
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;

    console.log(`[proxy] ${method} ${path}`);

    try {
      const body = await collectBody(req);

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
        else if (Array.isArray(value)) headers[key] = value.join(', ');
      }
      // Remove hop-by-hop headers
      delete headers['host'];
      delete headers['connection'];
      delete headers['transfer-encoding'];

      const fetchOpts: TunnelFetchOptions = { method, headers, body };
      const tunnelRes = await client.fetch(path, fetchOpts);

      if (tunnelRes.error) {
        console.log(`[proxy] ← ${tunnelRes.status} (error: ${tunnelRes.error})`);
      } else {
        console.log(`[proxy] ← ${tunnelRes.status}`);
      }

      // Write response headers
      for (const [key, value] of Object.entries(tunnelRes.headers)) {
        // Skip hop-by-hop headers
        if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) continue;
        res.setHeader(key, value);
      }

      res.writeHead(tunnelRes.status);
      res.end(tunnelRes.body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[proxy] Error: ${msg}`);
      res.writeHead(502);
      res.end(JSON.stringify({ error: msg }));
    }
  });

  server.listen(port, () => {
    console.log(`=== Nostr HTTP Tunnel Proxy ===`);
    console.log(`Proxying http://localhost:${port} → ${npub ?? pubkey}`);
    console.log(`Relays: ${relays.join(', ')}`);
    console.log(`Timeout: ${timeout}ms`);
    console.log('');
    console.log(`Try: curl http://localhost:${port}/`);
  });

  const shutdown = () => {
    console.log('\nShutting down proxy...');
    client.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
