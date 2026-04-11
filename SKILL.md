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
*Example: `http://<host>:<port>/api/monitors/list`*

### 📘 Canonical Monitor Type Reference

Agents should treat the repository monitor type map as required reading before creating or editing monitors:

- [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md)

If the skill instructions and that document ever diverge, prefer `docs/MONITOR-TYPES.md` and update the skill text to match before continuing.

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
| `/monitors/list` | `POST` | Returns all monitors as a dictionary keyed by ID. |
| `/monitors/add` | `POST` | **Payload:** `{"monitor": {...}}` where `monitor.type` controls which fields are required. |
| `/monitors/edit` | `POST` | **Payload:** `{"monitor_id": 42, "monitor": {...}}`. The patch is merged with the existing monitor, then validated against that monitor type. |
| `/monitors/delete`| `POST` | **Payload:** `{"monitor_id": 42}` |
| `/monitors/pause` | `POST` | **Payload:** `{"monitor_id": 42}` |
| `/monitors/resume`| `POST` | **Payload:** `{"monitor_id": 42}` |
| `/monitors/status`| `POST` | **Payload:** `{"monitor_id": 42}` (Returns heartbeat list). |

### 🧩 Monitor Type Required Fields
Use these minimum fields inside `monitor` for `/monitors/add`. For `/monitors/edit`, the final merged monitor must satisfy the same rules.

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
| `/tags/list` | `GET` | Returns all tag definitions (id, name, colour). |
| `/monitors/tags/set`| `POST` | **Payload:** `{"monitor_id": 42, "tags": ["#tag1", 3], "replace": true}` |
| `/monitors/tags/delete`| `POST` | **Payload:** `{"monitor_id": 42, "tags": ["#tag1"]}` |

### 🔔 Notifications & System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notifications/list`| `POST` | List all notification channels. |
| `/notifications/test`| `POST` | **Payload:** `{"id": 1}` (Tests a specific notification). |
| `/status-pages/list`| `POST` | List all status pages. |
| `/settings/get` | `POST` | Get current Kuma settings. |

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

1.  **Tagging Logic:** When adding tags via `/monitors/tags/set`, you can use a string (e.g., `"#production"`) to find/create a tag by name, or an integer to use an existing ID.
2.  **Monitor Merging:** The `/monitors/edit` endpoint is additive. You only need to send the fields you wish to change.
3.  **Error Handling:** All responses follow the pattern `{"ok": true, ...}` or `{"ok": false, "error": "..."}`. Always check the `ok` field before proceeding with logic.
4.  **2FA Awareness:** If the bridge is configured with a `KUMA_2FA_SECRET`, the agent can perform actions that require 2FA-protected sessions seamlessly via the existing connection.
