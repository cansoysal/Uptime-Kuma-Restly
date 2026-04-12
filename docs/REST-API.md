# REST API Reference

Snapshot date: 2026-04-12

This is the canonical REST reference for this repository.

Base paths:

- API root: `/api`
- Swagger UI: `/docs`
- OpenAPI JSON: `/api/openapi.json`

## Authentication

If `BRIDGE_TOKEN` is set, every `/api` route except the public routes below requires:

```http
Authorization: Bearer <BRIDGE_TOKEN>
Content-Type: application/json
```

Public routes:

- `GET /api/health`
- `GET /api/openapi.json`
- `GET /docs`
- `GET /docs/`

## Response Shape

Successful responses use:

```json
{
  "ok": true,
  "result": {}
}
```

Errors use:

```json
{
  "ok": false,
  "error": "message"
}
```

## Request Body Rules

Write routes accept raw JSON objects.

Examples:

- `POST /api/monitors` expects a raw monitor object.
- `POST /api/notifications` expects a raw notification object.
- `PATCH /api/settings` expects a raw settings object.

Swagger now shows resource-specific schemas for these bodies. Required markers in Swagger reflect bridge-level requirements and the common fields this bridge can describe reliably. Some nested provider-specific fields are still passed through directly to Uptime Kuma and remain resource-specific.

## Endpoints

### Health And Discovery

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/health` | Public health check |
| `GET` | `/api/openapi.json` | Public OpenAPI document |
| `GET` | `/docs` | Public Swagger UI |

### Monitors

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/monitors` | List monitors |
| `GET` | `/api/monitors/by-url?url=...` | Find by normalized URL |
| `POST` | `/api/monitors` | Create monitor from the raw monitor object |
| `PATCH` | `/api/monitors/:id` | Partial patch merged into the current monitor, then revalidated |
| `DELETE` | `/api/monitors/:id` | Delete monitor |
| `GET` | `/api/monitors/:id/status` | Heartbeat history |
| `POST` | `/api/monitors/:id/pause` | Pause monitor |
| `POST` | `/api/monitors/:id/resume` | Resume monitor |
| `PUT` | `/api/monitors/:id/tags` | Replace or set tags |
| `DELETE` | `/api/monitors/:id/tags` | Remove selected tags |
| `POST` | `/api/monitors/sniff` | Wait for the next raw add-monitor payload |

Monitor payloads are type-specific. Use [MONITOR-TYPES.md](MONITOR-TYPES.md) for the required fields by monitor type.

Monitor example:

```json
{
  "type": "http",
  "name": "Example",
  "url": "https://example.com",
  "interval": 60,
  "notifications": [1, 2],
  "tags": ["#production"]
}
```

Notes:

- `notifications` may be sent as an array of IDs; the bridge converts it to Kuma's `notificationIDList` format.
- `PATCH /api/monitors/:id` accepts a partial object, not a full replacement body.
- Push monitors get an auto-generated `pushToken` when omitted.

### Notifications

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/notifications` | List notification channels |
| `POST` | `/api/notifications` | Create notification |
| `PATCH` | `/api/notifications/:id` | Update notification |
| `DELETE` | `/api/notifications/:id` | Delete notification |
| `POST` | `/api/notifications/:id/test` | Test notification payload |

Request body:

```json
{
  "type": "apprise",
  "name": "Ops Apprise",
  "appriseURL": "https://apprise.example/notify/token"
}
```

Notes:

- Common required fields for create: `type`, `name`.
- Provider-specific nested fields are passed through to Uptime Kuma.
- The route path supplies the target ID for `PATCH` and `DELETE`.

### Proxies

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/proxies` | List proxies |
| `POST` | `/api/proxies` | Create proxy |
| `PATCH` | `/api/proxies/:id` | Update proxy |
| `DELETE` | `/api/proxies/:id` | Delete proxy |

Request body:

```json
{
  "protocol": "http",
  "host": "proxy.internal",
  "port": 8080,
  "username": "bridge-user",
  "password": "secret"
}
```

Notes:

- Common required fields for create: `protocol`, `host`, `port`.
- For `PATCH`, you may omit `id`; the route fills it from `:id`.
- Nested proxy fields are otherwise passed through.

### Status Pages

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/status-pages` | List status pages |
| `POST` | `/api/status-pages` | Create a new status page from `title` and `slug` |
| `PUT` | `/api/status-pages/:slug` | Save status page config and groups |
| `DELETE` | `/api/status-pages/:slug` | Delete status page |

Create request body:

```json
{
  "title": "Public Status",
  "slug": "public-status"
}
```

Save request body:

```json
{
  "slug": "public-status",
  "config": {
    "title": "Public Status",
    "description": "Current service health"
  },
  "publicGroupList": [],
  "imgDataUrl": null
}
```

Notes:

- `POST /api/status-pages` requires `title` and `slug` and only forwards those two fields.
- `PUT /api/status-pages/:slug` forwards `slug`, `config`, `imgDataUrl`, and `publicGroupList`.
- If the body omits `slug`, the route fills it from `:slug`.

### Tags

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/tags` | List tags |
| `POST` | `/api/tags` | Create tag |
| `PATCH` | `/api/tags/:id` | Update tag |
| `DELETE` | `/api/tags/:id` | Delete tag |

Request body:

```json
{
  "name": "#production",
  "color": "#22c55e"
}
```

Notes:

- Common required field for create: `name`.

### Settings

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/settings` | Get current Kuma settings |
| `PATCH` | `/api/settings` | Update settings |

Request body:

```json
{
  "theme": "dark",
  "title": "Uptime Kuma"
}
```

Notes:

- The bridge forwards the raw settings object directly to `setSettings`.
- There are no bridge-level required properties beyond sending a non-empty object.

### API Keys

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/api-keys` | List API keys |
| `POST` | `/api/api-keys` | Create API key |
| `POST` | `/api/api-keys/:id/enable` | Enable API key |
| `POST` | `/api/api-keys/:id/disable` | Disable API key |
| `DELETE` | `/api/api-keys/:id` | Delete API key |

Request body:

```json
{
  "name": "Bridge Key",
  "expiryDate": null,
  "active": true
}
```

Notes:

- Common required field for create: `name`.
- Enable, disable, and delete routes use only the path ID and do not require a body.

### Maintenances

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/maintenances` | List maintenances |
| `POST` | `/api/maintenances` | Create maintenance |
| `PATCH` | `/api/maintenances/:id` | Update maintenance |
| `DELETE` | `/api/maintenances/:id` | Delete maintenance |

Request body:

```json
{
  "title": "Weekly maintenance",
  "description": "Routine updates",
  "active": true
}
```

Notes:

- Common required field for create: `title`.
- Scheduling and targeting fields are passed through to Uptime Kuma and vary by maintenance strategy.
- For `PATCH`, you may omit `id`; the route fills it from `:id`.

### Compatibility Dispatcher

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/call` | Legacy compatibility method dispatch |

Request shape:

```json
{
  "method": "get_notifications",
  "args": [],
  "kwargs": {}
}
```

## Compatibility Notes

- The bridge keeps legacy root-path aliases, but `/api` is the intended public base path.
- The bridge aligns method mapping with the current documented Uptime Kuma Socket.IO surface.
- The live Swagger document at `/docs` is generated from `src/server.js`.

## Related References

- [MONITOR-TYPES.md](MONITOR-TYPES.md)
- [WRITE-PAYLOADS.md](WRITE-PAYLOADS.md)
- [UPTIME-KUMA-SOCKET-SNAPSHOT.md](UPTIME-KUMA-SOCKET-SNAPSHOT.md)
- [src/server.js](../src/server.js)
