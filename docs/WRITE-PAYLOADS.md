# Write Payloads

Snapshot date: 2026-04-12

This document describes the request bodies for the bridge's canonical REST-style write operations.

## Scope

- This file documents the bridge request payloads.
- Top-level field names in this file are enforced by the bridge.
- Nested object fields are mostly passed through to Uptime Kuma unless the bridge adds validation.
- Monitor nested fields are the main exception: they are source-backed and validated by monitor type. See [MONITOR-TYPES.md](MONITOR-TYPES.md).

## Conventions

- All endpoints below are under `/api`
- All request bodies are JSON
- All authenticated requests use:

```http
Authorization: Bearer <BRIDGE_TOKEN>
Content-Type: application/json
```

## Monitors

### `POST /monitors`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Full monitor object. Required fields depend on monitor type. |

Example:

```json
{
  "type": "http",
  "name": "Example",
  "url": "https://example.com",
  "interval": 60,
  "tags": ["#production"]
}
```

For the full monitor field matrix, see [MONITOR-TYPES.md](MONITOR-TYPES.md).

### `PATCH /monitors/:id`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing monitor ID |
| request body | object | yes | Partial patch merged into the existing monitor before validation |

Example:

```json
{
  "name": "Example - renamed",
  "interval": 120
}
```

### `PUT /monitors/:id/tags`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing monitor ID |
| `tags` | array | yes | Tag names, numeric IDs, or tag objects |
| `replace` | boolean | no | If `true`, replace existing monitor tags |

Example:

```json
{
  "tags": ["#production", 3],
  "replace": true
}
```

## Notifications

### `POST /notifications`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Notification definition passed through to Kuma |

Example:

```json
{
  "type": "apprise",
  "name": "Ops Apprise",
  "appriseURL": "https://apprise.example/notify/token"
}
```

### `PATCH /notifications/:id`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing notification ID |
| request body | object | yes | Updated notification definition |

Example:

```json
{
  "id": 7,
  "type": "apprise",
  "name": "Ops Apprise - primary",
  "appriseURL": "https://apprise.example/notify/token"
}
```

## Proxies

### `POST /proxies`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Proxy definition passed through to Kuma |

Example:

```json
{
  "protocol": "http",
  "host": "proxy.internal",
  "port": 8080,
  "username": "bridge-user",
  "password": "secret"
}
```

### `PATCH /proxies/:id`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing proxy ID |
| request body | object | yes | Updated proxy definition |

Example:

```json
{
  "id": 3,
  "protocol": "http",
  "host": "proxy.internal",
  "port": 8081,
  "username": "bridge-user",
  "password": "secret"
}
```

## Status Pages

### `POST /status-pages`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Bridge uses `title` and `slug` from this object |

Example:

```json
{
  "title": "Public Status",
  "slug": "public-status"
}
```

### `PUT /status-pages/:slug`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:slug` | string | yes | Status page slug |
| request body | object | yes | Full status page payload |
| `slug` | string | effectively yes | Used by the bridge when saving |
| `config` | object | usually yes | Status page configuration object |
| `publicGroupList` | array | usually yes | Public monitor groups for the status page |
| `imgDataUrl` | string or null | no | Optional image data |

Example:

```json
{
  "slug": "public-status",
  "config": {
    "title": "Public Status",
    "description": "Current service health"
  },
  "publicGroupList": []
}
```

## Tags

### `POST /tags`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Tag object passed through to Kuma |

Example:

```json
{
  "name": "#production",
  "color": "#22c55e"
}
```

### `PATCH /tags/:id`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing tag ID |
| request body | object | yes | Updated tag object |

Example:

```json
{
  "id": 5,
  "name": "#production",
  "color": "#16a34a"
}
```

## Settings

### `PATCH /settings`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Arbitrary Kuma settings object |

Example:

```json
{
  "theme": "dark"
}
```

## API Keys

### `POST /api-keys`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | API key definition passed through to Kuma |

Example:

```json
{
  "name": "Bridge Key",
  "expiryDate": null,
  "active": true
}
```

## Maintenances

### `POST /maintenances`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| request body | object | yes | Maintenance definition passed through to Kuma |

Example:

```json
{
  "title": "Weekly maintenance",
  "description": "Routine updates"
}
```

### `PATCH /maintenances/:id`

Fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| URL `:id` | integer | yes | Existing maintenance ID |
| request body | object | yes | Updated maintenance definition |

Example:

```json
{
  "id": 9,
  "title": "Weekly maintenance window",
  "description": "Routine updates"
}
```

## Notes On Nested Objects

The bridge currently validates these top-level write bodies directly for the REST routes:

- monitor object
- notification object
- proxy object
- status page object
- tag object
- settings object
- API key object
- maintenance object

For non-monitor resources, nested field details are mostly passed through to Kuma. If you need a full field catalog for a specific nested resource type, inspect the current Kuma UI payload or the relevant upstream source before relying on a guessed schema.

