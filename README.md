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
- [docs/IMAGE-TAGS.md](docs/IMAGE-TAGS.md)

Verification helper:

- `npm run check:socket-snapshot`
  - Compares the documented socket snapshot to a local Uptime Kuma source checkout
  - Default source path: `/tmp/uptime-kuma-official`
  - You can also pass a custom path:
    - `npm run check:socket-snapshot -- /path/to/uptime-kuma`
    - `node scripts/check-kuma-socket-snapshot.js /path/to/uptime-kuma`
  - Exits with code `2` when the snapshot and current source diverge

## Credits

This project is derived from the original Python bridge by `pr1ncey1987`:

- Original repository: https://github.com/pr1ncey1987/uptime-kuma-api-v2

Uptime Kuma Restly ports the bridge to Node.js and adds Docker packaging, including a combined Uptime Kuma + Restly container layout intended for homelab and Unraid-style deployments.
It also documents the current official Uptime Kuma Socket.IO surface from source snapshots instead of relying only on older third-party wrapper docs.

## Features

- **Full monitor management** — create, edit, delete, pause, resume
- **Tag support** — add, remove, and replace tags on monitors; create new tags on the fly with custom colours
- **Notification management** — list, add, edit, delete, and test notifications
- **Proxy, status page, maintenance, settings, and API key support** — broad coverage of the `uptime-kuma-api` wrapper surface
- **Bearer token authentication** — protect the bridge with a secret token
- **2FA / TOTP support** — works with Uptime Kuma accounts that have two-factor authentication enabled
- **Persistent connection** — single long-lived Socket.IO connection shared across all requests, with automatic reconnection
- **Clean shutdown** — Ctrl+C disconnects gracefully with no traceback
- **Small dependency set** — `socket.io-client`, `express`, `dotenv`, and `otplib`

## Why use this?

Uptime Kuma's API is Socket.IO only — there is no official HTTP REST API. This bridge sits between your application and Kuma, so you can:

- Automatically create monitors when you deploy a new site
- Tag monitors by project, client, or technology stack
- Integrate with CI/CD pipelines, CRM systems, or any tool that can make HTTP requests

## Monitor Payload Rules

Monitor create and edit requests are validated against the selected Uptime Kuma monitor type.

- `POST /api/monitors` requires a `type`-appropriate payload.
- `PATCH /api/monitors/:id` merges your patch into the existing monitor, then validates the final payload.
- Push monitors get a generated `pushToken` automatically if you do not send one.

Examples:

```json
{
  "type": "http",
  "name": "Example",
  "url": "https://example.com"
}
```

```json
{
  "type": "keyword",
  "name": "Homepage keyword",
  "url": "https://example.com",
  "keyword": "Example Domain"
}
```

```json
{
  "monitor": {
    "type": "docker",
    "name": "nginx container",
    "docker_container": "nginx",
    "docker_host": 1
  }
}
```

The full per-type required field list is documented in:

- [SKILL.md](SKILL.md)
- [docs/REST-API.md](docs/REST-API.md)

---

## Requirements

- Node.js 20+
- Uptime Kuma v2 (tested; may work with v1)
- Network access from the bridge host to the Kuma server

```bash
npm install
```

---

## Installation

```bash
git clone https://github.com/cansoysal/Uptime-Kuma-Restly.git
cd uptime-kuma-restly
cp .env.example .env
# Edit .env with your settings
npm install
node src/server.js
```

---

## Configuration

Create a `.env` file in the repository root:

```env
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=9911
BRIDGE_TOKEN=your-secret-token
BRIDGE_LOG_LEVEL=info
UPTIME_KUMA_TAG=2

KUMA_URL=http://your-kuma-server:3001
KUMA_USERNAME=admin
KUMA_PASSWORD=your-kuma-password

# Only required if your Kuma account has 2FA enabled
# This is the base32 SECRET string from the QR code — NOT a 6-digit code
KUMA_2FA_SECRET=

# Socket.IO call timeout in seconds (default 60)
KUMA_TIMEOUT=60
```

### Getting your 2FA secret

If Kuma 2FA is enabled, go to **Settings → Security → Two Factor Authentication → Setup**. The QR code encodes a URI like:

```
otpauth://totp/Uptime%20Kuma?secret=JBSWY3DPEHPK3PXP&issuer=...
```

The value after `secret=` is what goes in `KUMA_2FA_SECRET`. If you already set up 2FA without saving the secret, disable and re-enable it to retrieve it.

---

## Running

```bash
npm install
node src/server.js
```

## Testing

Run the HTTP endpoint test suite with:

```bash
npm test
```

The test suite uses Node's built-in test runner, starts the Express app without auto-booting the bridge server, and covers the public health/docs routes plus every registered `/api` endpoint with mocked Kuma client responses.

Output on start:

```
[bridge] Listening  : http://127.0.0.1:9911
[bridge] Kuma URL   : http://your-kuma-server:3001
[bridge] Timeout    : 60s
[bridge] Auth token : set
[bridge] 2FA        : enabled (otplib)
[bridge] Kuma connection established.
```

Press **Ctrl+C** to shut down cleanly.

To run as a background service, use `systemd`, `supervisor`, Docker, or a process manager like `pm2`.

### Docker

Build the image:

```bash
docker build -t uptime-kuma-restly .
```

Run it with an env file:

```bash
docker run --rm -p 9911:9911 \
  --env-file .env \
  uptime-kuma-restly
```

Example `docker-compose.yml` snippet:

```yaml
services:
  uptime-kuma-restly:
    build: .
    container_name: uptime-kuma-restly
    restart: unless-stopped
    ports:
      - "9911:9911"
    env_file:
      - .env
```

Full standalone example:

```bash
cp docker-compose.bridge-only.example docker-compose.yml
cp .env.example .env
# point KUMA_URL at your existing Kuma instance
docker compose up -d
```

Included example file:

- [docker-compose.bridge-only.example](docker-compose.bridge-only.example)

Notes:
- The bridge is implemented in Node.js and uses `socket.io-client` + `otplib`.
- If you leave `BRIDGE_HOST` at `127.0.0.1`, the service will only bind inside the container. For Docker, set `BRIDGE_HOST=0.0.0.0` in `.env`.
- For the standalone mode, set `KUMA_URL` to your external Kuma base URL, for example `http://192.0.2.10:3001`.

### Prebuilt Images

Prebuilt container images are available on GHCR:

- `ghcr.io/cansoysal/uptime-kuma-restly`
- `ghcr.io/cansoysal/uptime-kuma-restly-combined`

Pull the bridge-only image:

```bash
docker pull ghcr.io/cansoysal/uptime-kuma-restly:latest
```

Pull the combined image:

```bash
docker pull ghcr.io/cansoysal/uptime-kuma-restly-combined:latest
```

If you prefer a pinned image, use a version tag instead of `latest` when available.

Important note:

- if a GHCR package is private, users will need registry authentication before they can pull it

### Combined Uptime Kuma + Bridge Container

For Unraid-style packaging, this repo also includes a combined image definition that runs:

- Uptime Kuma on `3001`
- the REST bridge on `9911`

Primary health endpoints in the combined image:

- Kuma UI: `http://host:3001/`
- Bridge API: `http://host:9911/api/health`

Build it with:

```bash
docker build -f docker/combined.Dockerfile -t uptime-kuma-restly-combined .
```

To pin a specific Kuma base tag at build time:

```bash
docker build \
  -f docker/combined.Dockerfile \
  --build-arg UPTIME_KUMA_TAG=2 \
  -t uptime-kuma-restly-combined .
```

Suggested env for the combined image:

```env
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=9911
BRIDGE_TOKEN=your-secret-token
BRIDGE_LOG_LEVEL=info
UPTIME_KUMA_TAG=2
KUMA_URL=http://127.0.0.1:3001
KUMA_USERNAME=admin
KUMA_PASSWORD=your-kuma-password
KUMA_2FA_SECRET=
KUMA_TIMEOUT=60
```

Base image tag note:

- `UPTIME_KUMA_TAG=2` is the default and uses the full Uptime Kuma image
- `UPTIME_KUMA_TAG=2-slim` uses the slimmer image

Current difference:

- `2` includes embedded Chromium and embedded MariaDB support
- `2-slim` excludes those extras and is smaller

Practical recommendation:

- use `2` as the default for publishing and general users
- use `2-slim` only when you want a smaller image and do not need browser-engine / Chromium features

More detail:

- [docs/IMAGE-TAGS.md](docs/IMAGE-TAGS.md)

Suggested run command:

```bash
docker run -d \
  --name uptime-kuma-restly-combined \
  -p 3001:3001 \
  -p 9911:9911 \
  -v kuma-data:/app/data \
  --env-file .env \
  uptime-kuma-restly-combined
```

Compose example:

```bash
cp docker-compose.yml.example docker-compose.yml
cp .env.example .env
docker compose up -d
```

Included example file:

- [docker-compose.yml.example](docker-compose.yml.example)
- [unraid/uptime-kuma-bridge-combined.xml](unraid/uptime-kuma-bridge-combined.xml)
- [unraid/uptime-kuma-bridge-only.xml](unraid/uptime-kuma-bridge-only.xml)

Notes for Unraid:
- Persist `/app/data`.
- Use local storage for Kuma data; avoid NFS for SQLite-backed state.
- Default combined base tag is `2`.
- Set `UPTIME_KUMA_TAG` to pin a specific Kuma tag over time instead of rebuilding against a moving default blindly.
- The bridge depends on Kuma's internal Socket.IO API, so bridge compatibility should be versioned alongside Kuma.
- Replace the placeholder image/repo/support URLs in the XML before submitting to Community Apps.

### OpenClaw Skill

A complementary skill designed for the `app/docker bridge app`. This skill enables enhanced automation and interaction capabilities when using the bridge container, providing a more powerful way to interface with your Uptime Kuma instance.

---

## Authentication

All requests require a `Bearer` token header if `BRIDGE_TOKEN` is set:

```
Authorization: Bearer your-secret-token
```

Leave `BRIDGE_TOKEN` blank to disable authentication (not recommended for production).

Set `BRIDGE_LOG_LEVEL=debug` if you want verbose bridge logs for Socket.IO connect/login/event flow.

---

## API Reference

Primary API base:

```
/api
```

Swagger UI:

```
/docs
```

OpenAPI JSON:

```
/api/openapi.json
```

Bridge health endpoint:

```
/api/health
```

All endpoints accept and return `application/json`. All responses include `"ok": true` on success or `"ok": false` with an `"error"` field on failure.

Coverage note:
- The bridge preserves the original monitor- and tag-focused endpoints explicitly.
- It also exposes a wider method surface through `POST /call`, mapped to much of the documented `uptime-kuma-api` client surface.
- The current mapping has been updated against the latest official Uptime Kuma server source snapshot documented in [docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md](docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md).
- Some less common compatibility paths still depend on internal Socket.IO behavior and should not be treated as a stable public contract.
- Legacy root-path aliases are still mounted for compatibility, but `/api` is the preferred public base path.

### Health Check

```
GET /api/health
```

Returns bridge status and configuration info.

---

### Monitors

#### List all monitors

```
GET /api/monitors
```

Returns all monitors from Kuma as a dict keyed by monitor ID.

---

#### Find a monitor by URL

```
GET /api/monitors/by-url?url=https://example.com
```

Returns the first monitor whose URL matches (case-insensitive, ignores trailing slash).

---

#### Add a monitor

```
POST /api/monitors
```

```json
{
  "name": "My Website",
  "url": "https://example.com",
  "type": "http",
  "interval": 60,
  "notifications": [1, 2],
  "tags": ["#magento", 3, {"name": "#newtag", "color": "#7C3AED"}]
}
```

**`notifications`** — pass a plain array of notification channel IDs; the bridge converts it to the format Kuma expects.

**`tags`** — flexible input:
- `"#tagname"` — find existing tag by name (case-insensitive), create it if not found
- `2` — link by tag ID directly
- `{"name": "#tagname", "color": "#hex"}` — find by name, or create with this colour

All Kuma monitor fields are supported. Unspecified fields use sensible defaults.

---

#### Edit a monitor

```
PATCH /api/monitors/42
```

```json
{
  "name": "Updated Name",
  "interval": 30,
  "tags": ["#magento"]
}
```

Fetches the existing monitor and merges your changes, so you only need to send the fields you want to update. If `tags` is included it replaces all existing tags on the monitor.

---

#### Delete a monitor

```
DELETE /api/monitors/42
```

---

#### Pause a monitor

```
POST /api/monitors/42/pause
```

---

#### Resume a monitor

```
POST /api/monitors/42/resume
```

---

#### Get monitor status / heartbeats

```
GET /api/monitors/42/status
```

Returns the heartbeat list for the monitor.

### Additional Resource Endpoints

The bridge also exposes direct endpoints for several common non-monitor resources:

- `GET /api/notifications`
- `POST /api/notifications`
- `PATCH /api/notifications/:id`
- `DELETE /api/notifications/:id`
- `POST /api/notifications/:id/test`
- `GET /api/proxies`
- `POST /api/proxies`
- `PATCH /api/proxies/:id`
- `DELETE /api/proxies/:id`
- `GET /api/status-pages`
- `POST /api/status-pages`
- `PUT /api/status-pages/:slug`
- `DELETE /api/status-pages/:slug`
- `GET /api/tags`
- `POST /api/tags`
- `PATCH /api/tags/:id`
- `DELETE /api/tags/:id`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `POST /api/api-keys/:id/enable`
- `POST /api/api-keys/:id/disable`
- `DELETE /api/api-keys/:id`
- `GET /api/maintenances`
- `POST /api/maintenances`
- `PATCH /api/maintenances/:id`
- `DELETE /api/maintenances/:id`

### Compatibility Method Dispatch

Use `POST /api/call` with:

```json
{
  "method": "get_notifications",
  "args": [],
  "kwargs": {}
}
```

The bridge now maps a large subset of the methods documented by `uptime-kuma-api`, including:

- monitor CRUD and status methods
- notifications
- proxies
- status pages and incidents
- tags
- settings
- Docker hosts
- maintenances
- API keys
- auth and setup helpers
- database helpers
- selected diagnostics like `get_game_list` and `test_chrome`

---

### Tags

#### List all tag definitions

```
GET /api/tags
```

Returns all tag definitions from Kuma (id, name, colour).

---

#### Add tags to a monitor

```
PUT /api/monitors/42/tags
```

```json
{
  "tags": ["#magento", 3]
}
```

Adds the specified tags to the monitor. Existing tags are kept unless you pass `"replace": true`.

```json
{
  "tags": ["#magento"],
  "replace": true
}
```

With `"replace": true`, all existing tags on the monitor are removed first, then the new ones are applied.

---

#### Remove tags from a monitor

```
DELETE /api/monitors/42/tags
```

```json
{
  "tags": ["#magento"]
}
```

Removes only the specified tags. Other tags on the monitor are unaffected. Accepts tag names, IDs, or dicts.

---

### Sniff (debug)

```
POST /api/monitors/sniff
```

```json
{ "timeout": 60 }
```

Blocks for up to `timeout` seconds waiting for you to add a monitor through the Kuma web UI. Returns the exact raw Socket.IO payload that Kuma sent. Useful for discovering what fields your specific Kuma version expects.

---

## curl Examples

```bash
TOKEN="your-secret-token"
BASE="http://127.0.0.1:9911/api"

# Add a monitor with tags
curl -s -X POST $BASE/monitors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Site", "url": "https://example.com", "type": "http", "tags": ["#production"]}'

# Edit a monitor
curl -s -X PATCH $BASE/monitors/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"interval": 30}'

# Add a tag to an existing monitor
curl -s -X PUT $BASE/monitors/42/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["#magento"]}'

# Remove a tag
curl -s -X DELETE $BASE/monitors/42/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["#magento"]}'

# Replace all tags
curl -s -X PUT $BASE/monitors/42/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["#wordpress", "#production"], "replace": true}'

# List all monitors
curl -s $BASE/monitors \
  -H "Authorization: Bearer $TOKEN"

# Pause / resume
curl -s -X POST $BASE/monitors/42/pause \
  -H "Authorization: Bearer $TOKEN"
```

---

## Technical Notes

- The bridge maintains a **single persistent Socket.IO connection** to Kuma, shared across all HTTP requests. If the connection drops it reconnects automatically on the next request.
- Tags use Kuma's `addMonitorTag` / `deleteMonitorTag` socket events with positional arguments (not a single object — this is a quirk of the Kuma Socket.IO API).
- Newly created tag definitions are cached in memory immediately so they can be found by name in subsequent requests within the same session.
- The tag cache is seeded on first use via a `getTags` socket call (Kuma does not push this automatically on connect).

---

## License

MIT
