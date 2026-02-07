# Nostr HTTP Tunnel

A VPS-free HTTP tunnel that uses Nostr relays as the transport layer and NIP-17/NIP-44 encrypted DMs as the communication channel.

No VPS, no port forwarding, no DNS. The Nostr relay network acts as the public-facing endpoint. The agent runs alongside your app behind NAT.

## How It Works

```
[Client]
  │
  ├─ HTTP request ──→ NIP-44 encrypt ──→ NIP-17 gift-wrap ──→ [Nostr Relay(s)] ──→ unwrap ──→ [Agent] ──→ [Your App]
  │
  └─ HTTP response ←── NIP-44 decrypt ←── NIP-17 gift-wrap ←── [Nostr Relay(s)] ←── wrap ←── [Agent] ←── [Your App]
```

All traffic is end-to-end encrypted. Relay operators cannot read request or response content.

## Packages

| Package | Description |
|---------|-------------|
| `@nostr-http-tunnel/protocol` | Shared types and envelope serialization |
| `@nostr-http-tunnel/agent` | Local agent that forwards tunnel requests to your app |
| `@nostr-http-tunnel/client` | Client library with `fetch()`-like API + local HTTP proxy |

## Quick Start

### 1. Start the Agent

```bash
# Clone and install
git clone https://github.com/themikemoniker/nostr-http-tunnel.git
cd nostr-http-tunnel
npm install
npm run build

# Start the agent (assumes your app is on localhost:8080)
TARGET_URL=http://localhost:8080 \
RELAY_URLS=wss://relay.damus.io,wss://nos.lol \
node packages/agent/dist/index.js
```

The agent will print its `npub` on startup. Share this with clients.

### 2. Use the Client Library

```typescript
import { createTunnelClient } from '@nostr-http-tunnel/client'

const client = createTunnelClient({
  serviceNpub: 'npub1...', // the agent's npub
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
})

const response = await client.fetch('/api/data', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hello: 'world' }),
})

console.log(response.status) // 200
console.log(response.body)   // response body as string
```

### 3. Use the Local HTTP Proxy

The proxy makes the tunnel transparent to any HTTP client:

```bash
# Start the proxy
node packages/client/dist/proxy.js --npub npub1... --relays wss://relay.damus.io,wss://nos.lol --port 3000

# Now use curl, fetch, or any HTTP client
curl http://localhost:3000/api/data
```

## Docker Compose

```yaml
services:
  myapp:
    image: my-web-app:latest
    # No published ports needed

  nostr-tunnel:
    build:
      context: .
      dockerfile: packages/agent/Dockerfile
    environment:
      - TARGET_URL=http://myapp:8080
      - RELAY_URLS=wss://relay.damus.io,wss://nos.lol
    volumes:
      - ./tunnel-data:/data
```

```bash
docker compose up
```

The agent auto-generates a Nostr keypair on first run and persists it to the volume.

## Configuration

### Agent Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_URL` | `http://localhost:8080` | URL of your local service |
| `RELAY_URLS` | `wss://relay.damus.io,wss://nos.lol` | Comma-separated relay URLs |
| `NOSTR_PRIVATE_KEY` | (auto-generated) | Hex-encoded private key |
| `MAX_RESPONSE_SIZE` | `262144` (256KB) | Max response body size in bytes |
| `KEY_PATH` | `./nostr-tunnel.key` | Path to persist auto-generated key |
| `DATA_DIR` | `.` | Data directory (used for key storage) |

### Proxy CLI Options

```
--npub <npub>       Agent's npub (or SERVICE_NPUB env var)
--pubkey <hex>      Agent's pubkey hex (or SERVICE_PUBKEY env var)
--relays <urls>     Comma-separated relay URLs (or RELAY_URLS env var)
--port <port>       Local proxy port (default: 3000, or PROXY_PORT env var)
--key <hex>         Client private key (or NOSTR_PRIVATE_KEY env var)
--timeout <ms>      Request timeout (default: 30000, or REQUEST_TIMEOUT env var)
```

## Protocol

Requests and responses use a simple JSON envelope transported inside NIP-17 gift-wrapped DMs:

**Request** (client -> agent):
```json
{
  "v": 1,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/webhook",
  "headers": { "content-type": "application/json" },
  "body": "<base64 encoded>"
}
```

**Response** (agent -> client):
```json
{
  "v": 1,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": 200,
  "headers": { "content-type": "application/json" },
  "body": "<base64 encoded>"
}
```

## Prior Art

- [NWC (NIP-47)](https://github.com/nostr-protocol/nips/blob/master/47.md) — RPC-over-Nostr-DMs for Lightning wallets
- [Nostr Terminal](https://github.com/cmdruid/nostr-terminal) — Terminal tunneling over Nostr
- [nostr-emitter](https://github.com/cmdruid/nostr-emitter) — E2E encrypted event emitter over Nostr
- [Blossom](https://github.com/hzrd149/blossom) — Nostr-native blob storage for static assets

## License

MIT
