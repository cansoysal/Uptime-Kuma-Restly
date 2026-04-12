# uptime_kuma_restly

**Description:** This skill is a complementary interface for the [Uptime-Kuma-Restly](https://github.com/cansoysal/Uptime-Kuma-Restly) Node.js/Docker service. It provides a REST API interface to manage Uptime Kuma monitors, tags, notifications, and status pages via HTTP.

## 🛠️ Agent Instructions

### ⚠️ Pre-requisite: Onboarding & Setup
This skill **cannot be used** until the underlying service is deployed and running. 

**First-time Use Protocol:**
When an agent attempts to use this skill for the first time in a session, it **MUST** ask the user for the following two pieces of information:
1. **Bridge URL:** The full URL of the running bridge (e.g., `http://localhost:9911`).
2. **Bridge Token:** The secret token used for authentication. (Inform the user that an empty string is acceptable if no token is required).

**Do not proceed with any API calls until these values are provided.**

### 🔐 Authentication
All requests **MUST** include the `Authorization` header with the token provided during onboarding.
`Authorization: Bearer <BRIDGE_TOKEN>`

**Note:** If no `BRIDGE_TOKEN` was configured in the bridge application, the `Authorization` header is not required and can be omitted.

### 📡 Base URL
The base path for all API calls is `/api`. 
*Example: `http://<host>:<port>/api/monitors`*

### 📘 Canonical Monitor Type Reference

Agents should treat the repository monitor type map as required reading before creating or editing monitors:

- [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md)
- [docs/REST-API.md](docs/REST-API.md)
- [docs/WRITE-PAYLOADS.md](docs/WRITE-PAYLOADS.md)

If the skill instructions and that document ever diverge, prefer `docs/MONITOR-TYPES.md` and update the skill text to match before continuing.

For non-monitor write endpoints such as notifications, proxies, tags, status pages, settings, API keys, and maintenances, prefer [docs/REST-API.md](docs/REST-API.md) and `/api/openapi.json`. The live OpenAPI document is the quickest way to discover endpoint paths, request schemas, and which fields are marked required vs optional.

### 🔎 Endpoint Discovery Order

When an agent needs to discover or verify endpoints:

1. Check `/api/openapi.json` first for the current route and schema surface.
2. Use `/docs` for a human-readable Swagger view.
3. Use [docs/REST-API.md](docs/REST-API.md) for bridge-specific notes and examples.
4. Use [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md) for monitor-type validation rules.

Do not assume wrapper keys like `notification`, `proxy`, `status_page`, `settings`, `api_key`, or `maintenance`. The REST routes accept raw JSON objects for those resources unless the OpenAPI document says otherwise.

---

## 📋 API Reference

### 🔍 Health & Discovery
| Endpoint | Method | Description |
|---------|--------|-------------|
| `/health` | `GET` | Returns bridge status and configuration. |
| `/monitors/sniff` | `POST` | **Debugging:** Blocks and returns the raw Socket.IO payload when a monitor is added via the Kuma UI. |

### 🖥️ Monitor Management
| Endpoint | Method | Payload/Description |
|----------|--------|---------------------|
| `/monitors` | `GET` | Returns all monitors as a dictionary keyed by ID. |
| `/monitors` | `POST` | **Payload:** monitor object where `type` controls required fields. |
| `/monitors/:id` | `PATCH` | **Payload:** partial monitor patch merged into the existing monitor before validation. |
| `/monitors/:id`| `DELETE` | Deletes a monitor by ID. |
| `/monitors/:id/pause` | `POST` | Pauses a monitor. |
| `/monitors/:id/resume`| `POST` | Resumes a monitor. |
| `/monitors/:id/status`| `GET` | Returns heartbeat list for a monitor. |
| `/monitors/by-url?url=...` | `GET` | Finds a monitor by URL. |

### 🧩 Monitor Type Required Fields
Use these minimum fields in the request body for `POST /monitors`. For `PATCH /monitors/:id`, the final merged monitor must satisfy the same rules.
Use these minimum fields inside the request body for `POST /monitors`. For `PATCH /monitors/:id`, the final merged monitor must satisfy the same rules.

This section mirrors [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md) so the skill remains usable even when the agent only has the skill file open.

| Monitor Type | Required Fields |
|-------------|-----------------|
| `http` | `url` |
| `keyword` | `url`, `keyword` |
| `json-query` | `url`, `jsonPath`, `jsonPathOperator`, `expectedValue` |
| `port` | `hostname`, `port` |
| `ping` | `hostname` |
| `dns` | `hostname`, `dns_resolve_server`, `port` |
| `docker` | `docker_container`, `docker_host` |
| `system-service` | `system_service_name` |
| `real-browser` | `url` |
| `group` | no extra type-specific fields |
| `push` | no extra type-specific fields; the bridge auto-generates `pushToken` if omitted |
| `manual` | no extra type-specific fields |
| `globalping` + `subtype: "ping"` | `subtype`, `hostname`, `protocol` |
| `globalping` + `subtype: "http"` | `subtype`, `url`, `protocol` |
| `globalping` + `subtype: "dns"` | `subtype`, `hostname`, `port`, `protocol` |
| `grpc-keyword` | `grpcUrl`, `keyword`, `grpcServiceName`, `grpcMethod` |
| `kafka-producer` | `kafkaProducerBrokers`, `kafkaProducerTopic`, `kafkaProducerMessage` |
| `mqtt` | `hostname`, `mqttTopic` |
| `mqtt` with `mqttCheckType: "json-query"` | `hostname`, `mqttTopic`, `jsonPath`, `expectedValue` |
| `rabbitmq` | `rabbitmqNodes`, `rabbitmqUsername`, `rabbitmqPassword` |
| `sip-options` | `hostname`, `port` |
| `smtp` | `hostname`, `port` |
| `snmp` | `hostname`, `port`, `radiusPassword`, `snmpOid`, `jsonPath`, `jsonPathOperator`, `expectedValue` |
| `snmp` with `snmpVersion: "3"` | all SNMP fields above plus `snmpV3Username` |
| `tailscale-ping` | `hostname` |
| `websocket-upgrade` | `url` |
| `sqlserver` | `databaseConnectionString` |
| `mongodb` | `databaseConnectionString` |
| `mysql` | `databaseConnectionString` |
| `oracledb` | `databaseConnectionString`, `basic_auth_user`, `basic_auth_pass` |
| `postgres` | `databaseConnectionString` |
| `radius` | `hostname`, `port`, `radiusUsername`, `radiusPassword`, `radiusSecret`, `radiusCalledStationId`, `radiusCallingStationId` |
| `redis` | `databaseConnectionString` |
| `gamedig` | `hostname`, `port`, `game` |
| `steam` | `hostname`, `port` |

### 🔐 Conditional Auth Fields
For `http`, `keyword`, `json-query`, and `globalping` HTTP monitors:

| Condition | Required Fields |
|----------|-----------------|
| `authMethod: "mtls"` | `tlsCert`, `tlsKey` |
| `authMethod: "oauth2-cc"` | `oauth_token_url`, `oauth_client_id`, `oauth_client_secret` |

For `kafka-producer` with `kafkaProducerSaslOptions.mechanism: "aws"`:

| Condition | Required Fields |
|----------|-----------------|
| AWS SASL | `kafkaProducerSaslOptions.authorizationIdentity`, `kafkaProducerSaslOptions.accessKeyId`, `kafkaProducerSaslOptions.secretAccessKey` |

### 🏷️ Tagging
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tags` | `GET` | Returns all tag definitions (id, name, colour). |
| `/tags` | `POST` | Creates a tag from a raw tag object such as `{"name":"#production","color":"#22c55e"}`. |
| `/tags/:id` | `PATCH` | Updates a tag from a raw tag object. |
| `/tags/:id` | `DELETE` | Deletes a tag by ID. |
| `/monitors/:id/tags`| `PUT` | **Payload:** `{"tags": ["#tag1", 3], "replace": true}` |
| `/monitors/:id/tags`| `DELETE` | **Payload:** `{"tags": ["#tag1"]}` |

### 🔔 Notifications & System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notifications`| `GET` | List all notification channels. |
| `/notifications`| `POST` | Create a notification from a raw notification object. Common create fields: `type`, `name`. |
| `/notifications/:id`| `PATCH` | Update a notification from a raw notification object. |
| `/notifications/:id`| `DELETE` | Delete a notification by ID. |
| `/notifications/:id/test`| `POST` | Test a notification using a raw notification object. |
| `/proxies`| `GET` | List proxies. |
| `/proxies`| `POST` | Create a proxy from a raw proxy object. Common create fields: `protocol`, `host`, `port`. |
| `/proxies/:id`| `PATCH` | Update a proxy from a raw proxy object. |
| `/proxies/:id`| `DELETE` | Delete a proxy by ID. |
| `/status-pages`| `GET` | List all status pages. |
| `/status-pages`| `POST` | Create a status page from a raw object. Required create fields: `title`, `slug`. |
| `/status-pages/:slug`| `PUT` | Save a status page using a raw object. Common fields: `slug`, `config`, `imgDataUrl`, `publicGroupList`. |
| `/status-pages/:slug`| `DELETE` | Delete a status page by slug. |
| `/settings` | `GET` | Get current Kuma settings. |
| `/settings` | `PATCH` | Update Kuma settings from a raw settings object. |
| `/api-keys` | `GET` | List API keys. |
| `/api-keys` | `POST` | Create an API key from a raw object. Common create field: `name`. |
| `/api-keys/:id/enable` | `POST` | Enable an API key. |
| `/api-keys/:id/disable` | `POST` | Disable an API key. |
| `/api-keys/:id` | `DELETE` | Delete an API key. |
| `/maintenances` | `GET` | List maintenances. |
| `/maintenances` | `POST` | Create a maintenance from a raw object. Common create field: `title`. |
| `/maintenances/:id` | `PATCH` | Update a maintenance from a raw object. |
| `/maintenances/:id` | `DELETE` | Delete a maintenance by ID. |

---

## 🚀 Advanced: The `/api/call` Method

For any method not explicitly listed above, use the generic `/call` endpoint. This allows you to execute any method documented in the `uptime-kuma-api` client.

**Endpoint:** `POST /api/call`

**Payload Structure:**
```json
{
  "method": "method_name",
  "args": [],
  "kwargs": {}
}
```

**Example (Get API Keys):**
```bash
curl -X POST "http://localhost:9911/api/call" \
     -H "Authorization: Bearer your-token" \
     -d '{"method": "get_api_keys", "args": [], "kwargs": {}}'
```

---

## 💡 Implementation Tips for Agents

1.  **Tagging Logic:** When updating tags via `PUT /monitors/:id/tags`, you can use a string (e.g., `"#production"`) to find/create a tag by name, or an integer to use an existing ID.
2.  **Monitor Merging:** `PATCH /monitors/:id` is additive. You only need to send the fields you wish to change.
3.  **Error Handling:** All responses follow the pattern `{"ok": true, ...}` or `{"ok": false, "error": "..."}`. Always check the `ok` field before proceeding with logic.
4.  **2FA Awareness:** If the bridge is configured with a `KUMA_2FA_SECRET`, the agent can perform actions that require 2FA-protected sessions seamlessly via the existing connection.
