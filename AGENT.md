# AGENT.md

This file tells coding agents how to work in this repository.

## Project

- Project name: `Uptime Kuma Restly`
- Purpose: expose Uptime Kuma's internal Socket.IO API as a REST API with Swagger docs
- Runtime: Node.js 20+
- Main server: [src/server.js](src/server.js)
- API base path: `/api`
- Docs path: `/docs`
- OpenAPI JSON: `/api/openapi.json`

## Repo Layout

- [src/server.js](src/server.js): Express app, Socket.IO bridge, OpenAPI spec
- [test/api.test.js](test/api.test.js): one test per public endpoint
- [scripts/check-kuma-socket-snapshot.js](scripts/check-kuma-socket-snapshot.js): compares the current documented socket snapshot to official Uptime Kuma source
- [docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md](docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md): dated snapshot of official socket events/handlers
- [docs/REST-API.md](docs/REST-API.md): public REST endpoint inventory
- [docker/combined.Dockerfile](docker/combined.Dockerfile): combined Kuma + Restly image
- [docker-compose.bridge-only.example](docker-compose.bridge-only.example): bridge-only example
- [docker-compose.yml.example](docker-compose.yml.example): combined example
- [unraid/uptime-kuma-bridge-only.xml](unraid/uptime-kuma-bridge-only.xml): Unraid template for external Kuma
- [unraid/uptime-kuma-bridge-combined.xml](unraid/uptime-kuma-bridge-combined.xml): Unraid template for combined image

## Normal Workflow

When changing this repo:

1. Make the code change in [src/server.js](src/server.js) or related docs/templates.
2. Add or update tests in [test/api.test.js](test/api.test.js).
3. Run:
   - `npm test`
4. If the change touches Uptime Kuma socket methods or supported events, also run:
   - `npm run check:socket-snapshot`
5. Update docs when behavior or names change:
   - [README.md](README.md)
   - [docs/REST-API.md](docs/REST-API.md)
   - [docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md](docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md) if the official socket surface changed

## Testing Rules

- Keep one test per endpoint where practical.
- Tests should not require a real Kuma server for routine verification.
- Use mocked Kuma client responses unless the task explicitly requires a live integration test.
- The current test suite validates:
  - public health/docs routes
  - auth enforcement
  - validation behavior
  - one success test per registered `/api` endpoint

Run:

```bash
npm test
```

## Upgrading Uptime Kuma

This project depends on Uptime Kuma's internal Socket.IO API. Upstream changes can break the bridge even when Docker builds still succeed.

When a new Uptime Kuma version or tag is introduced:

1. Clone or update the official source locally:

```bash
git clone --depth 1 https://github.com/louislam/uptime-kuma.git /tmp/uptime-kuma-official
```

Or update an existing checkout:

```bash
git -C /tmp/uptime-kuma-official fetch --tags --prune
git -C /tmp/uptime-kuma-official pull --ff-only
```

2. Run the snapshot drift checker:

```bash
npm run check:socket-snapshot
```

Or against a custom checkout:

```bash
npm run check:socket-snapshot -- /path/to/uptime-kuma
```

3. Interpret the result:
   - Exit code `0`: documented snapshot matches the inspected source
   - Exit code `2`: upstream socket handlers or pushed events changed and the bridge may need migration

4. If migration is required:
   - inspect the upstream handler files under `server/socket-handlers/`, `server/server.js`, `server/client.js`, and related model files
   - update method/event wiring in [src/server.js](src/server.js)
   - update [docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md](docs/UPTIME-KUMA-SOCKET-SNAPSHOT.md) with a new date and corrected event inventory
   - rerun:
     - `npm run check:socket-snapshot`
     - `npm test`

5. If the combined image should track the new version, update `UPTIME_KUMA_TAG` usage or examples as needed and verify the combined image still builds.

## How To Add Or Update APIs

Agents extending the API should follow this order:

1. Inspect official Uptime Kuma source, not only third-party wrappers.
2. Determine the exact current Socket.IO event name and argument order.
3. Update the bridge implementation in [src/server.js](src/server.js):
   - add or adjust a `METHOD_MAP` entry if the capability belongs in compatibility dispatch
   - add or adjust a first-class route under `/api/...` if this should be part of the public REST surface
   - preserve argument order for multi-argument Socket.IO calls
4. Update OpenAPI metadata in [src/server.js](src/server.js) if a first-class route is added or changed.
5. Add or update tests in [test/api.test.js](test/api.test.js).
6. Update docs:
   - [docs/REST-API.md](docs/REST-API.md)
   - [README.md](README.md) if usage changed
   - [SKILL.md](SKILL.md) if agent-facing payload requirements changed
7. Run:
   - `npm test`
   - `npm run check:socket-snapshot` if the change was driven by upstream socket drift

## Monitor Payload Model

This repo now maintains explicit per-type monitor payload requirements for `/api/monitors/add` and `/api/monitors/edit`.

- Treat the model in [src/server.js](src/server.js) as source-backed compatibility logic, not a hand-written convenience schema.
- When Uptime Kuma adds, removes, or changes monitor types or required fields, inspect upstream source first:
  - `server/uptime-kuma-server.js`
  - `server/server.js`
  - `server/model/monitor.js`
  - `src/pages/EditMonitor.vue`
- Keep all of these in sync when changing monitor requirements:
  - runtime validation in [src/server.js](src/server.js)
  - OpenAPI schemas in [src/server.js](src/server.js)
  - agent instructions in [SKILL.md](SKILL.md)
  - user-facing guidance in [README.md](README.md) and [docs/REST-API.md](docs/REST-API.md)
- Do not loosen required fields based only on older wrappers or third-party libraries if official Uptime Kuma source disagrees.

## API Design Rules

- Prefer first-class `/api/...` routes for commonly used resources.
- Use `POST /api/call` only for compatibility or lower-frequency methods.
- Keep public health/docs routes unauthenticated:
  - `/health`
  - `/api/health`
  - `/api/openapi.json`
  - `/docs`
- Preserve Bearer token protection for normal API routes when `BRIDGE_TOKEN` is set.
- Do not silently change route names without updating tests and docs.

## Packaging Rules

- Keep image names and docs aligned with the current branding: `Uptime Kuma Restly`
- Bridge-only examples use the Restly image
- Combined examples use the Restly combined image
- If changing image names or repo naming, update:
  - Compose examples
  - README examples
  - Unraid XML templates
  - package metadata where relevant

## Safety Notes

- Do not commit `.env`
- Do not commit runtime SQLite data like `kuma.db`
- Do not assume third-party wrapper docs are current when official source disagrees
- Prefer source-backed changes over speculative method additions
