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

## 📦 Distributions

This project provides two distinct distributions: the **Bridge** (the core product) and the **Combined** package (a specialized, all-in-one distribution).

### 🔹 1. The Bridge (Default)
*A lightweight sidecar/API layer designed to connect to an existing Uptime Kuma instance.*

- **Best for:** Users who already have Uptime Kuma running (e.g., in a separate container or host) and want to add the REST API layer.
- **Primary Image Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:latest`
- **Versioned Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:v0.1.0-bridge`

**Example `docker-compose.yml`:**
```yaml
services:
  uptime-kuma-restly:
    image: ghcr.io/cansoysal/uptime-kuma-restly:latest
    container_name: uptime-kuma-restly
    ports:
      - "9911:9911"
    env_file:
      - .env
    restart: unless-stopped
```

### 🚀 2. The Combined Package (All-in-One)
*A frozen, single-container package that bundles a specific version of Uptime Kuma (**v2.2.1**) with the Restly Bridge.*

- **Best for:** New installations or users who want a single, self-contained, "plug-and-play" unit.
- **Primary Image Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:latest-combined`
- **Versioned Tag:** `ghcr.io/cansoysal/uptime-kuma-restly:v1.0.1-combined`

**Example `docker-compose.yml`:**
```yaml
services:
  uptime-kuma-restly:
    image: ghcr.io/cansoysal/uptime-kuma-restly:latest-combined
    container_name: uptime-kuma-restly
    ports:
      - "3001:3001" # Kuma UI
      - "9911:9911" # Bridge API
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

2. **Clone the official Uptime Kuma source (Required for snapshot testing):**
*This is needed to verify that the documented socket surface matches the official implementation.*
```bash
# Note: This directory is already in .gitignore
git clone --depth 1 https://github.com/louislam/uptime-kuma.git ./uptime-kuma
```

3. **Install dependencies and run:**
```bash
npm install
# To run the bridge
node src/server.js
```

### 🔍 Verification Helper

To ensure the documented socket snapshot matches the official Uptime Kuma source:

**Option 1: Running from Source (Developers)**
If you are running the bridge via `npm start` locally:
```bash
# 1. Clone the official source
git clone --depth 1 https://github.com/louislam/uptime-kuma.git ./uptime-kuma

# 2. Run the check
npm run check:socket-snapshot
```

**Option 2: Running against a Docker Container (Production/Unraid Users)**
If you are using the official image, run this single command from your host. It uses a tiny, temporary `node:20-alpine` container so you don't need to install anything on your host machine.
```bash
# 1. Clone the official source to your host
git clone --depth 1 https://github.com/louislam/uptime-kuma.git ./uptime-kuma

# 2. Run the check via a temporary container
docker run --rm -v $(pwd)/uptime-kuma:/app/uptime-kuma node:20-alpine \
  sh -c "cd /app/uptime-kuma && npx ../scripts/check-kuma-socket-snapshot.js /app/uptime-kuma ../docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md"
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
KUMA_URL=http://your-kuma-server:3001
KUMA_USERNAME=admin
KUMA_PASSWORD=your-kuma-password

# Only required if your Kuma account has 2FA enabled
KUMA_2FA_SECRET=
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
All requests **MUST** include the `Authorization` header with the token provided in your configuration.
`Authorization: Bearer <BRIDGE_TOKEN>`

## 📜 License
MIT
