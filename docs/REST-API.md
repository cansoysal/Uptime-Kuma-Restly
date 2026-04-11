# REST API

Snapshot date: 2026-04-11

This document reflects the REST surface implemented by this repository at the time of the snapshot above.

Primary API base:

- `/api`

Public unauthenticated endpoints:

- `GET /api/health`
- `GET /api/openapi.json`
- `GET /docs`
- `GET /docs/`

Authenticated endpoints:

Monitors
- `POST /api/monitors/list`
- `POST /api/monitors/find`
- `POST /api/monitors/add`
- `POST /api/monitors/edit`
- `POST /api/monitors/delete`
- `POST /api/monitors/status`
- `POST /api/monitors/pause`
- `POST /api/monitors/resume`
- `POST /api/monitors/tags/set`
- `POST /api/monitors/tags/delete`
- `POST /api/monitors/sniff`

Notifications
- `POST /api/notifications/list`
- `POST /api/notifications/add`
- `POST /api/notifications/edit`
- `POST /api/notifications/delete`
- `POST /api/notifications/test`

Proxies
- `POST /api/proxies/list`
- `POST /api/proxies/add`
- `POST /api/proxies/edit`
- `POST /api/proxies/delete`

Status pages
- `POST /api/status-pages/list`
- `POST /api/status-pages/add`
- `POST /api/status-pages/save`
- `POST /api/status-pages/delete`

Tags
- `POST /api/tags/list`
- `POST /api/tags/add`
- `POST /api/tags/edit`
- `POST /api/tags/delete`

Settings
- `POST /api/settings/get`
- `POST /api/settings/set`

API keys
- `POST /api/api-keys/list`
- `POST /api/api-keys/add`
- `POST /api/api-keys/enable`
- `POST /api/api-keys/disable`
- `POST /api/api-keys/delete`

Maintenances
- `POST /api/maintenances/list`
- `POST /api/maintenances/add`
- `POST /api/maintenances/edit`
- `POST /api/maintenances/delete`

Compatibility dispatcher
- `POST /api/call`

Compatibility notes

- The bridge keeps legacy root-path aliases for the same endpoints, but `/api` is the intended public base path.
- The bridge aligns to current official Uptime Kuma Socket.IO event names where possible.
- For monitor add/edit, the bridge validates the final payload against the selected monitor type before calling Kuma.
- For monitor add/edit, the bridge retries after removing unsupported fields when an older Kuma schema reports `no column named ...`.
- Push monitors get an auto-generated `pushToken` if the payload omits one.

Authentication

- If `BRIDGE_TOKEN` is set, authenticated endpoints require:
  - `Authorization: Bearer <token>`
- `/api/health`, `/api/openapi.json`, and `/docs` remain public so browser access and container healthchecks work.

References

- Implementation source:
  - [src/server.js](../src/server.js)
- Monitor type and required field reference:
  - [MONITOR-TYPES.md](MONITOR-TYPES.md)
- Generated OpenAPI document:
  - `/api/openapi.json`
