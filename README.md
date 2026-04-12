# Uptime Kuma Restly

A lightweight Node.js service that exposes [Uptime Kuma](https://github.com/louislam/uptime-kuma) as a simple REST-like API. Manage monitors, tags, and status checks from any language or tool using plain HTTP instead of talking to Socket.IO directly.

Primary paths:

- `/api` for API requests
- `/docs` for Swagger UI
- `/api/openapi.json` for the OpenAPI document

Documentation:

- [docs/REST-API.md](docs/REST-API.md) - canonical REST reference
- [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md)
- [docs/WRITE-PAYLOADS.md](docs/WRITE-PAYLOADS.md) - write-body cheat sheet
- [docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md](docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md)

## 💡 Motivation

As I increasingly rely on AI-deployed services and "vibe-coded" applications, the overhead of manual monitoring updates becomes a bottleneck. This tool provides a way to bridge that gap, allowing AI agents to autonomously manage and update Uptime Kuma monitor configurations through a standardized REST interface.

## 📦 Distributions

This project provides two distinct distributions: the **Standard Version** (the core product) and the **Combined Package** (a specialized, all-in-one distribution).

### 🔹 1. The Standard Version (Default)
*A lightweight sidecar/API layer designed to connect to an existing Uptime Kuma instance.*

- **Best for:** Users who already have Uptime Kuma running (e.g., in a separate container or host) and want to add the REST API layer.
- **Primary Image Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:latest`
- **Versioned Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:v1.0.0-bridge`

**Example `docker-compose.yml`:**
```yaml
services:
  uptime-kuma-restly:
    image: ghcr.io/cansoysal/uptime-kuma-restly:latest
    container_name: uptime-kuma-restly
    ports:
      - "9911:9911"
    environment:
      - BRIDGE_HOST=${BRIDGE_HOST:-0.0.0.0}
      - BRIDGE_PORT=${BRIDGE_PORT:-9911}
      - BRIDGE_TOKEN=${BRIDGE_TOKEN:-BridgeSecretToken}
      - BRIDGE_LOG_LEVEL=${BRIDGE_LOG_LEVEL:-info}
      - KUMA_URL=${KUMA_URL:-https://my.kuma.url}
      - KUMA_USERNAME=${KUMA_USERNAME:-mykumausername}
      - KUMA_PASSWORD=${KUMA_PASSWORD:-mykumapassword}
      - KUMA_2FA_SECRET=${KUMA_2FA_SECRET:-your-2fa-secret}
      - KUMA_TIMEOUT=${KUMA_TIMEOUT:-60}
    env_file:
      - .env
    restart: unless-stopped
```

### 🚀 2. The Combined Package (All-in-One)
*A frozen, single-container package that bundles a specific version of Uptime Kuma (**v2.2.1**) with the API layer.*

- **Best for:** New installations or users who want a single, self-contained, "plug-and-play" unit.
- **Primary Image Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:latest-combined`
- **Versioned Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:v1.0.0-combined`

**Note:** For Unraid users, a unified XML template is available in the `unraid/` directory that supports both versions.

**Example `docker-compose.yml`:**
```yaml
services:
  uptime-kuma-restly:
    image: ghcr.io/cansoysal/uptime-kuma-restly:latest-combined
    container_name: uptime-kuma-restly
    ports:
      - "3001:3001" # Uptime Kuma UI
      - "9911:9911" # API
    environment:
      - BRIDGE_HOST=${BRIDGE_HOST:-0.0.0.0}
      - BRIDGE_PORT=${BRIDGE_PORT:-9911}
      - BRIDGE_TOKEN=${BRIDGE_TOKEN:-BridgeSecretToken}
      - BRIDGE_LOG_LEVEL=${BRIDGE_LOG_LEVEL:-info}
      - KUMA_URL=${KUMA_URL:-http://127.0.0.1:3001}
      - KUMA_USERNAME=${KUMA_USERNAME:-mykumausername}
      - KUMA_PASSWORD=${KUMA_PASSWORD:-mykumapassword}
      - KUMA_2FA_SECRET=${KUMA_2FA_SECRET:-your-2fa-secret}
      - KUMA_TIMEOUT=${KUMA_TIMEOUT:-60}
    env_file:
      - .env
    restart: unless-stopped
```

---

## 🛠️ Development Setup

If you are a developer and want to build the project from source:

1. **Clone the repository:**
```bash
git clone https://github.com/cansoysal/Uptime-Kuma-Restly.git
cd uptime-kuma-restly
```

2. **Install dependencies and run:**
```bash
npm install
# To run the bridge
node src/server.js
```

---

## ⚙️ Configuration

Create a `.env` file in the repository root:

```env
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=9911
BRIDGE_TOKEN=your-secret-token
BRIDGE_LOG_LEVEL=info

# For Bridge-Only mode, point to your existing Kuma instance
KUMA_URL=https://my.kuma.url
KUMA_USERNAME=mykumausername
KUMA_PASSWORD=mykumapassword

# Only required if your Kuma account has 2FA enabled
KUMA_2FA_SECRET=your-2fa-secret
```

## 📋 API Reference

### Monitor Payload Rules
Monitor create and edit requests are validated against the selected Uptime Kuma monitor type.

- `POST /api/monitors` requires a `type`-appropriate payload.
- `PATCH /api/monitors/:id` merges your patch into the existing monitor, then validates the final payload.

The full per-type required field list and detailed payload structures are documented in:
- [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md)
- [docs/WRITE-PAYLOADS.md](docs/WRITE-PAYLOADS.md)
- [docs/REST-API.md](docs/REST-API.md)

### 🛡️ Authentication
If a `BRIDGE_TOKEN` is configured, all requests **MUST** include the `Authorization` header with that token.
`Authorization: Bearer ${BRIDGE_TOKEN}`

## 📜 License
MIT