#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
import { generateSecretKey } from 'nostr-tools/pure';
import { TunnelAgent } from './agent.js';

function loadOrGenerateKey(keyPath: string): string {
  if (existsSync(keyPath)) {
    const hex = readFileSync(keyPath, 'utf-8').trim();
    console.log(`Loaded private key from ${keyPath}`);
    return hex;
  }

  const sk = generateSecretKey();
  const hex = bytesToHex(sk);
  const dir = dirname(keyPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(keyPath, hex, { mode: 0o600 });
  console.log(`Generated new private key and saved to ${keyPath}`);
  return hex;
}

function main(): void {
  const targetUrl = process.env.TARGET_URL ?? 'http://localhost:8080';
  const relayUrls = (process.env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const maxResponseSize = parseInt(process.env.MAX_RESPONSE_SIZE ?? '262144', 10); // 256KB default
  const keyPath = process.env.KEY_PATH ?? join(process.env.DATA_DIR ?? '.', 'nostr-tunnel.key');

  let privateKey: string;
  if (process.env.NOSTR_PRIVATE_KEY) {
    privateKey = process.env.NOSTR_PRIVATE_KEY;
    console.log('Using private key from NOSTR_PRIVATE_KEY env var');
  } else {
    privateKey = loadOrGenerateKey(keyPath);
  }

  const agent = new TunnelAgent({
    privateKey,
    targetUrl,
    relayUrls,
    maxResponseSize,
  });

  agent.start();

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();

export { TunnelAgent } from './agent.js';
export type { AgentConfig } from './agent.js';
