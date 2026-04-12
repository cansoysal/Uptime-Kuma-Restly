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

### 📘 Canonical Data & Discovery (Mandatory)

**Do not rely on static tables within this file for payload structures.** To prevent errors caused by stale information, agents **MUST** use the following discovery order when performing write operations (POST/PATCH/PUT):

1. **Check `/api/openapi.json` First:** This is the most authoritative source for current route paths, required fields, and data types.
2. **Consult [docs/MONITOR-TYPES.md](docs/MONITOR-TYPES.md):** Use this for the specific validation rules and required fields for different monitor types (e.g., `http`, `dns`, `mqtt`).
3. **Consult [docs/WRITE-PAYLOADS.md](docs/WRITE-PAYLOADS.md):** Use this for specialized payload structures and edge cases.
4. **Use the `/monitors/sniff` Endpoint:** If you are unsure of a valid payload for a specific monitor type, use this endpoint to intercept a real request from the Kuma UI to see the exact structure expected by the bridge.

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
| `/monitors` | `POST` | **Payload:** Monitor object. Refer to `/api/openapi.json` and `docs/MONITOR-TYPES.md` for required fields based on `type`. |
| `/monitors/:id` | `PATCH` | **Payload:** Partial monitor patch. The final merged monitor must satisfy all type-specific validation rules. |
| `/monitors/:id`| `DELETE` | Deletes a monitor by ID. |
| `/monitors/:id/pause` | `POST` | Pauses a monitor. |
| `/monitors/:id/resume`| `POST` | Resumes a monitor. |
| `/monitors/:id/status`| `GET` | Returns heartbeat list for a monitor. |
| `/monitors/by-url?url=...` | `GET` | Finds a monitor by URL. |

### 🏷️ Tagging
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tags` | `GET` | Returns all tag definitions (id, name, colour). |
| `/tags` | `POST` | Creates a tag from a raw tag object such as `{"name":"#production","color":"#22c55e"}`. |
| `/tags/:id` | `PATCH` | Updates a tag from a raw tag object. |
| `/tags/:id` | `DELETE` | Deletes a tag by ID. |
| `/monitors/:id/tags`| `PUT` | **Payload:** `{"tags": ["#tag1", 3], "replace": true}`. |
| `/monitors/:id/tags`| `DELETE` | **Payload:** `{"tags": ["#tag1"]}`. |

### 🔔 Notifications & System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notifications`| `GET` | List all notification channels. |
| `/notifications`| `POST` | Create a notification from a raw notification object. |
| `/notifications/:id`| `PATCH` | Update a notification from a raw notification object. |
| `/notifications/:id`| `DELETE` | Delete a notification by ID. |
| `/notifications/:id/test`| `POST` | Test a notification using a raw notification object. |
| `/proxies`| `GET` | List proxies. |
| `/proxies`| `POST` | Create a proxy from a raw proxy object. |
| `/proxies/:id`| `PATCH` | Update a proxy from a raw proxy object. |
| `/proxies/:id`| `DELETE` | Delete a proxy by ID. |
| `/status-pages`| `GET` | List all status pages. |
| `/status-pages`| `POST` | Create a status page from a raw object. |
| `/status-pages/:slug`| `PUT` | Save a status page using a raw object. |
| `/status-pages/:slug`| `DELETE` | Delete a status page by slug. |
| `/settings` | `GET` | Get current Kuma settings. |
| `/settings` | `PATCH` | Update Kuma settings from a raw settings object. |
| `/api-keys` | `GET` | List API keys. |
| `/api-keys` | `POST` | Create an API key from a raw object. |
| `/api-keys/:id/enable` | `POST` | Enable an API key. |
| `/api-keys/:id/disable` | `POST` | Disable an API key. |
| `/api-keys/:id` | `DELETE` | Delete an API key. |
| `/maintenances` | `GET` | List maintenances. |
| `/maintenances` | `POST` | Create a maintenance from a raw object. |
| `/maintenances/:id` | `PATCH` | Update a maintenance from a raw object. |

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

---

## 💡 Implementation Tips for Agents

1. **Validation is Strict:** Always verify your payload against the `type` of the monitor or resource. If you add a field during a `PATCH`, ensure the resulting object is still valid according to Uptime Kuma's requirements.
2. **Check the 'ok' Field:** All responses follow the pattern `{"ok": true, ...}` or `{"ok": false, "error": "..."}`. Always check the `ok` field before proceeding.
3. **Tagging Logic:** When updating tags via `PUT /monitors/:id/tags`, you can use a string (e.g., `"#production"`) to find/create a tag by name, or an integer to use an existing ID.
4. **The Source of Truth:** If there is any doubt about a field name or required parameter, **always** check `/api/openapi.json` or `docs/MONITOR-TYPES.md` before making the call.