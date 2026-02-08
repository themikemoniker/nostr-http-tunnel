# Nostr HTTP Tunnel

A VPS-free HTTP tunnel that uses Nostr relays as the transport layer. NIP-17 gift-wrapped, NIP-44 encrypted DMs carry HTTP requests and responses. No VPS, no port forwarding, no DNS — the Nostr relay network is the public endpoint.

```
Client ──→ NIP-44 encrypt ──→ Nostr Relay(s) ──→ decrypt ──→ Agent ──→ Your App
Client ←── NIP-44 decrypt ←── Nostr Relay(s) ←── encrypt ←── Agent ←── Your App
```

All traffic is end-to-end encrypted. Relay operators cannot read request or response content.

## Packages

| Package | Description |
|---------|-------------|
| `@nostr-http-tunnel/protocol` | Shared types and envelope serialization |
| `@nostr-http-tunnel/agent` | Local agent that forwards tunnel requests to your app |
| `@nostr-http-tunnel/client` | Client library with `fetch()`-like API + local HTTP proxy |
| `@nostr-http-tunnel/widget` | Embeddable `<lightning-widget>` web component for payments |

## Quick Start with Docker Compose

The included `docker-compose.yml` runs the tunnel agent alongside a phoenixd auth proxy, so you can accept Lightning payments through Nostr with zero exposed ports.

### Prerequisites

- [phoenixd](https://github.com/ACINQ/phoenixd) running on the host
- Docker and Docker Compose

### 1. Install and start phoenixd

```bash
wget https://github.com/ACINQ/phoenixd/releases/download/v0.7.2/phoenixd-0.7.2-linux-x64.zip
unzip phoenixd-0.7.2-linux-x64.zip
sudo mv phoenixd-0.7.2-linux-x64/phoenixd /usr/local/bin/
sudo mv phoenixd-0.7.2-linux-x64/phoenix-cli /usr/local/bin/

phoenixd --agree-to-terms-of-service &
```

On first run, phoenixd creates `~/.phoenix/` with your seed, wallet, and API passwords. **Back up `~/.phoenix/seed.dat` immediately.**

### 2. Clone and configure

```bash
git clone https://github.com/themikemoniker/nostr-http-tunnel.git
cd nostr-http-tunnel

# Create .env with your phoenixd limited-access password
echo "PHOENIXD_PASSWORD=$(grep '^http-password-limited-access' ~/.phoenix/phoenix.conf | cut -d= -f2)" > .env
```

The limited-access password allows `createinvoice`, `getinfo`, `getbalance` but **blocks** `payinvoice`, `sendtoaddress`, and `closechannel`.

### 3. Start the tunnel

```bash
docker compose up -d
```

This starts two containers (both using host networking):

- **phoenixd-proxy** — injects Basic Auth and enforces an endpoint allowlist
- **nostr-tunnel** — the tunnel agent, listening on Nostr relays

Check the logs to get your agent's npub:

```bash
docker compose logs nostr-tunnel
```

```
npub: npub1abc123...
Agent is running. Waiting for requests...
```

### 4. Test it

```bash
# Through the proxy (from the host)
curl http://localhost:3001/getinfo
curl -X POST http://localhost:3001/createinvoice -d amountSat=1000 -d description="test"

# Verify dangerous endpoints are blocked
curl -X POST http://localhost:3001/payinvoice -d invoice="lnbc1"
# → {"error":"Path /payinvoice is not allowed through the tunnel"}
```

### 5. Add the widget to your website

```html
<script src="https://unpkg.com/@nostr-http-tunnel/widget"></script>
<lightning-widget
  npub="npub1..."
  relays="wss://relay.damus.io,wss://nos.lol"
></lightning-widget>
```

The widget is a self-contained web component. It starts as a small button and expands on click. All communication goes through Nostr relays — no backend needed on the website.

Attributes:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `npub` | (required) | Your tunnel agent's npub |
| `relays` | `wss://relay.damus.io,wss://nos.lol` | Comma-separated relay URLs |
| `amounts` | `100,500,1000,5000,10000` | Preset sat amounts for the buttons |
| `title` | `Zap Me` | Button and header text |

## Manual Setup (without Docker)

### Start the Agent

```bash
npm install
npm run build

TARGET_URL=http://localhost:8080 \
RELAY_URLS=wss://relay.damus.io,wss://nos.lol \
node packages/agent/dist/index.js
```

The agent prints its `npub` on startup. Share this with clients.

### Client Library

```typescript
import { createTunnelClient } from '@nostr-http-tunnel/client'

const client = createTunnelClient({
  serviceNpub: 'npub1...',
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

### Local HTTP Proxy

Makes the tunnel transparent to any HTTP client:

```bash
node packages/client/dist/proxy.js --npub npub1... --relays wss://relay.damus.io,wss://nos.lol --port 3000

curl http://localhost:3000/api/data
```

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

### phoenixd Auth Proxy Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PHOENIXD_PASSWORD` | (required) | phoenixd API password |
| `PHOENIXD_HOST` | `127.0.0.1` | phoenixd host |
| `PHOENIXD_PORT` | `9740` | phoenixd port |
| `PROXY_PORT` | `3001` | Proxy listen port |
| `PROXY_BIND` | `127.0.0.1` | Proxy bind address |

### Security

The auth proxy uses the **limited-access** password and enforces a path allowlist:

| Allowed | Blocked |
|---------|---------|
| `/getinfo` | `/payinvoice` |
| `/getbalance` | `/payoffer` |
| `/createinvoice` | `/paylnaddress` |
| `/getoffer` | `/sendtoaddress` |
| `/decodeinvoice` | `/closechannel` |
| `/payments/incoming` | `/lnurlpay` |
| `/payments/outgoing` | `/lnurlauth` |

Even if someone crafts a malicious request through the tunnel, both the proxy allowlist and phoenixd's limited-access password reject it.

## Protocol

Requests and responses use a JSON envelope inside NIP-17 gift-wrapped DMs:

```json
// Request (client → agent)
{ "v": 1, "id": "uuid", "method": "POST", "path": "/api/x", "headers": {...}, "body": "<base64>" }

// Response (agent → client)
{ "v": 1, "id": "uuid", "status": 200, "headers": {...}, "body": "<base64>" }
```

## Prior Art

- [NWC (NIP-47)](https://github.com/nostr-protocol/nips/blob/master/47.md) — RPC-over-Nostr-DMs for Lightning wallets
- [Nostr Terminal](https://github.com/cmdruid/nostr-terminal) — Terminal tunneling over Nostr
- [nostr-emitter](https://github.com/cmdruid/nostr-emitter) — E2E encrypted event emitter over Nostr

## License

MIT
