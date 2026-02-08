import { createServer, request as httpRequest } from 'node:http'

const PHOENIXD_HOST = process.env.PHOENIXD_HOST || '127.0.0.1'
const PHOENIXD_PORT = parseInt(process.env.PHOENIXD_PORT || '9740', 10)
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '3001', 10)
const PROXY_BIND = process.env.PROXY_BIND || '127.0.0.1'
const PHOENIXD_PASSWORD = process.env.PHOENIXD_PASSWORD || ''

// Endpoints reachable with limited-access password (no outgoing payments)
const ALLOWED_PATHS = new Set([
  '/getinfo',
  '/getbalance',
  '/createinvoice',
  '/getoffer',
  '/decodeinvoice',
  '/decodeoffer',
  '/listchannels',
  '/estimateliquidityfees',
  '/payments/incoming',
  '/payments/outgoing',
])

if (!PHOENIXD_PASSWORD) {
  console.error('Error: PHOENIXD_PASSWORD is required.')
  console.error('Usage: PHOENIXD_PASSWORD=<password> node proxy.mjs')
  process.exit(1)
}

const authHeader = 'Basic ' + Buffer.from(`_:${PHOENIXD_PASSWORD}`).toString('base64')

const server = createServer((req, res) => {
  // Path allowlist check: match exact path or prefix (for /payments/incoming/{hash})
  const path = req.url.split('?')[0]
  const allowed = ALLOWED_PATHS.has(path) ||
    path.startsWith('/payments/incoming/') ||
    path.startsWith('/payments/outgoing/')

  if (!allowed) {
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: `Path ${path} is not allowed through the tunnel` }))
    console.log(`BLOCKED ${req.method} ${req.url}`)
    return
  }

  const proxyReq = httpRequest({
    hostname: PHOENIXD_HOST,
    port: PHOENIXD_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      authorization: authHeader,
      host: `${PHOENIXD_HOST}:${PHOENIXD_PORT}`,
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error(`Proxy error: ${err.message}`)
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'phoenixd unreachable' }))
  })

  req.pipe(proxyReq)
})

server.listen(PROXY_PORT, PROXY_BIND, () => {
  console.log(`phoenixd auth proxy listening on http://${PROXY_BIND}:${PROXY_PORT}`)
  console.log(`Forwarding to phoenixd at ${PHOENIXD_HOST}:${PHOENIXD_PORT}`)
  console.log(`Allowed paths: ${[...ALLOWED_PATHS].join(', ')}`)
})
