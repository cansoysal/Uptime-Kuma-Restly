# Write Payload Cheat Sheet

Snapshot date: 2026-04-12

The canonical API reference now lives in [REST-API.md](REST-API.md).
This file is the short version: it only shows the top-level request body shape for write routes.

## Raw Monitor Bodies

These routes accept the monitor object directly, without a wrapper key:

- `POST /api/monitors`
- `PATCH /api/monitors/:id`

Example:

```json
{
  "type": "http",
  "name": "Example",
  "url": "https://example.com"
}
```

For the per-type field matrix, use [MONITOR-TYPES.md](MONITOR-TYPES.md).

## Other Resource Bodies

These routes also accept raw JSON objects, not wrapper keys.

Examples:

```json
{
  "type": "apprise",
  "name": "Ops Apprise",
  "appriseURL": "https://apprise.example/notify/token"
}
```

```json
{
  "protocol": "http",
  "host": "proxy.internal",
  "port": 8080
}
```

```json
{
  "title": "Public Status",
  "slug": "public-status"
}
```

```json
{
  "theme": "dark"
}
```

```json
{
  "name": "Bridge Key",
  "expiryDate": null,
  "active": true
}
```

```json
{
  "title": "Weekly maintenance",
  "description": "Routine updates"
}
```

For endpoint-by-endpoint notes and route semantics, use [REST-API.md](REST-API.md).
