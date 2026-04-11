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

Authenticated endpoints

Preferred REST endpoints

Monitors
- `GET /api/monitors`
- `GET /api/monitors/by-url?url=...`
- `POST /api/monitors`
- `PATCH /api/monitors/:id`
- `DELETE /api/monitors/:id`
- `GET /api/monitors/:id/status`
- `POST /api/monitors/:id/pause`
- `POST /api/monitors/:id/resume`
- `PUT /api/monitors/:id/tags`
- `DELETE /api/monitors/:id/tags`
- `POST /api/monitors/sniff`

Notifications
- `GET /api/notifications`
- `POST /api/notifications`
- `PATCH /api/notifications/:id`
- `DELETE /api/notifications/:id`
- `POST /api/notifications/:id/test`

Proxies
- `GET /api/proxies`
- `POST /api/proxies`
- `PATCH /api/proxies/:id`
- `DELETE /api/proxies/:id`

Status pages
- `GET /api/status-pages`
- `POST /api/status-pages`
- `PUT /api/status-pages/:slug`
- `DELETE /api/status-pages/:slug`

Tags
- `GET /api/tags`
- `POST /api/tags`
- `PATCH /api/tags/:id`
- `DELETE /api/tags/:id`

Settings
- `GET /api/settings`
- `PATCH /api/settings`

API keys
- `GET /api/api-keys`
- `POST /api/api-keys`
- `POST /api/api-keys/:id/enable`
- `POST /api/api-keys/:id/disable`
- `DELETE /api/api-keys/:id`

Maintenances
- `GET /api/maintenances`
- `POST /api/maintenances`
- `PATCH /api/maintenances/:id`
- `DELETE /api/maintenances/:id`

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
- Write payload and example reference:
  - [WRITE-PAYLOADS.md](WRITE-PAYLOADS.md)
- Generated OpenAPI document:
  - `/api/openapi.json`
