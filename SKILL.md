# uptime_kuma_restly

**Description:** This skill is a complementary interface for the [Uptime-Kuma-Restly](https://github.com/cansoysal/Uptime-Kuma-Restly) Node.js/Docker service. It provides a REST API interface to manage Uptime Kuma monitors, tags, notifications, and status pages via HTTP.

## 🛠️ Agent Instructions

### ⚠️ Pre-requisite: Onboarding & Setup
This skill **cannot be used** until the underlying service is deployed and running. 

**First-time Use Protocol:**
When an agent attempts to use this skill for the first time in a session, it **MUST** ask the user for:
1. **Bridge URL:** The full URL of the running bridge (e.g., `http://<host>:<port>`).
2. **Bridge Token:** The secret token used for authentication. (Note: If no token is configured, you do not need to provide one or send an Authorization header).

**Do not proceed with any API calls until these values are provided.**

### 🔐 Authentication
If a `BRIDGE_TOKEN` is configured, all requests **MUST** include the `Authorization` header:
`Authorization: Bearer ${BRIDGE_TOKEN}`

**Note:** If no `BRIDGE_TOKEN` was configured in the environment, you do not need to send this header.

### 📡 Base URL
The base path for all API calls is `/api`. 
*Example: `http://<host>:<port>/api/monitors`*

### 📘 Discovery & Payload Validation (Mandatory)

**IMPORTANT:** **The live `/api/openapi.json` endpoint is the ONLY source of truth for all endpoints, methods, and payload structures.**

1. **Primary Source:** Always check `/api/openapi.json` first. This contains all current route paths, HTTP methods (GET, POST, etc.), and required fields.
2. **Live Debugging:** To understand complex payload structures (like monitor types), use the `/monitors/sniff` endpoint to intercept and inspect real-time Socket.IO payloads from the Uptime Kuma UI.

---

## 📋 API Capability Reference

### 🔍 System & Discovery
- **Health Check:** `/health` — Returns bridge status and configuration.
- **Live Monitoring:** `/monitors/sniff` — Intercept real-time socket payloads from the UI.

### 🖥️ Monitor Management
Manage and inspect Uptime Kuma monitors (List, Create, Update, Delete, Pause/Resume, and Status tracking).
- **List/Create/Delete:** `/monitors`
- **Update/Pause/Resume/Status:** `/monitors/:id`
- **By URL:** `/monitors/by-url?url=...`

### 🏷️ Tagging
Manage tag definitions and their associations with monitors.
- **List/Create/Delete:** `/tags`
- **Update/Remove from Monitor:** `/monitors/:id/tags`

### 🔔 Notifications & System
Manage notification channels, proxies, and system-wide settings.
- **Notifications:** `/notifications` (List, Create, Update, Delete, and Test)
- **Proxies:** `/proxies` (List, Create, Update, Delete)
- **API Keys:** `/api-keys` (List, Create, Enable, Disable, Delete)
- **Settings:** `/settings` (Get and Update)
- **Status Pages:** `/status-pages` (List, Create, Update, Delete)

### 🚀 Advanced: The `/api/call` Method
For any method not explicitly listed above, use the generic `/call` endpoint to execute any method documented in the `uptime-kuma-api` client.
**Payload:** `{"method": "method_name", "args": [], "kwargs": {}}`

---

## 💡 Implementation Tips for Agents

1. **Validation is Strict:** Always verify your JSON payload against the `type` of the resource using the `/api/openapi.json` spec.
2. **Check the 'ok' Field:** All responses follow the pattern `{"ok": true, ...}` or `{"ok": false, "error": "..."}`. Always check the `ok` field before proceeding.
3. **Handle Defaults:** If a request fails due to missing parameters, use the discovery tools mentioned above to find the correct structure.
