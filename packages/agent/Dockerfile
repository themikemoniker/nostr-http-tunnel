FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace root
COPY package.json tsconfig.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/agent/package.json packages/agent/

# Install dependencies
RUN npm install

# Copy source
COPY packages/protocol/ packages/protocol/
COPY packages/agent/ packages/agent/

# Build
RUN npm run build --workspace=packages/protocol && npm run build --workspace=packages/agent

FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/protocol/package.json packages/protocol/
COPY --from=builder /app/packages/protocol/dist/ packages/protocol/dist/
COPY --from=builder /app/packages/agent/package.json packages/agent/
COPY --from=builder /app/packages/agent/dist/ packages/agent/dist/

RUN npm install --omit=dev

ENV DATA_DIR=/data

VOLUME ["/data"]

CMD ["node", "packages/agent/dist/index.js"]
