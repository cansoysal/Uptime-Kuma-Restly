"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.BRIDGE_TOKEN = "test-bridge-token";
process.env.BRIDGE_HOST = "127.0.0.1";
process.env.BRIDGE_PORT = "9911";
process.env.KUMA_URL = "http://127.0.0.1:3001";
process.env.KUMA_TIMEOUT = "5";

const { app, pool } = require("../src/server");

function createFakeClient() {
  return {
    connected: true,
    getMonitors: async () => ({ "1": { id: 1, name: "Example Monitor", url: "https://example.com", tags: [] } }),
    getTags: async () => [{ id: 10, name: "#demo", color: "#ffffff" }],
    findMonitorByUrl: async (url) => ({ id: 1, name: "Example Monitor", url }),
    addMonitor: async (monitor) => ({ monitorID: 2, monitor }),
    editMonitor: async (monitorId, monitor) => ({ ok: true, monitorId, monitor }),
    deleteMonitor: async (monitorId) => ({ ok: true, monitorId }),
    getHeartbeats: async (monitorId) => ({ monitorId, beats: [] }),
    pauseMonitor: async (monitorId) => ({ ok: true, monitorId }),
    resumeMonitor: async (monitorId) => ({ ok: true, monitorId }),
    setMonitorTags: async (monitorId, tags, replace) => ({ monitorId, tags, replace }),
    removeMonitorTags: async (monitorId, tags) => ({ monitorId, tags }),
    getNotifications: async () => [{ id: 20, name: "Email" }],
    getProxies: async () => [{ id: 30, host: "proxy.local" }],
    getStatusPageList: async () => [{ id: 40, slug: "status" }],
    getMaintenanceList: async () => [{ id: 50, title: "Window" }],
    getAPIKeyList: async () => [{ id: 60, name: "Key" }],
    sniffNextAdd: async (timeout) => ({ timeout, monitor: { id: 99 } }),
    genericCall: async (eventName, ...payload) => ({ eventName, payload }),
  };
}

let server;
let baseUrl;
let originalPoolGet;

test.before(async () => {
  originalPoolGet = pool.get;
  pool.get = async () => createFakeClient();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  pool.get = originalPoolGet;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function request(path, options = {}) {
  const headers = {
    ...(options.auth === false ? {} : { authorization: "Bearer test-bridge-token" }),
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: options.redirect || "follow",
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function endpointSuccessTest(name, path, body) {
  test(name, async () => {
    const result = await request(path, { body });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
  });
}

test("GET /api/health works without auth", async () => {
  const result = await request("/api/health", { method: "GET", auth: false });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
});

test("GET /health works without auth", async () => {
  const result = await request("/health", { method: "GET", auth: false });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
});

test("GET /api/openapi.json works without auth", async () => {
  const result = await request("/api/openapi.json", { method: "GET", auth: false });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.openapi, "3.0.3");
});

test("GET /docs works without auth", async () => {
  const result = await request("/docs", { method: "GET", auth: false });
  assert.equal(result.response.status, 200);
  assert.match(result.body, /swagger/i);
});

test("POST /api/monitors/list requires auth when token is configured", async () => {
  const result = await request("/api/monitors/list", { auth: false });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors/list rejects invalid bearer tokens", async () => {
  const result = await request("/api/monitors/list", {
    headers: { authorization: "Bearer wrong-token" },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors/find validates required url", async () => {
  const result = await request("/api/monitors/find", { body: {} });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors/add validates required monitor", async () => {
  const result = await request("/api/monitors/add", { body: {} });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors/add validates type-specific required fields", async () => {
  const result = await request("/api/monitors/add", {
    body: {
      monitor: { type: "keyword", url: "https://example.com" },
    },
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error, /requires field\(s\): keyword/);
});

test("POST /api/monitors/add auto-generates a push token", async () => {
  const result = await request("/api/monitors/add", {
    body: {
      monitor: { type: "push", name: "Passive monitor" },
    },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.result.monitor.pushToken, "string");
  assert.equal(result.body.result.monitor.pushToken.length, 32);
});

test("POST /api/monitors/edit validates the merged monitor payload", async () => {
  const result = await request("/api/monitors/edit", {
    body: {
      monitor_id: 1,
      monitor: { type: "docker" },
    },
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error, /requires field\(s\): docker_container, docker_host/);
});

test("POST /api/call validates required method", async () => {
  const result = await request("/api/call", { body: {} });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
});

endpointSuccessTest("POST /api/monitors/list", "/api/monitors/list");
endpointSuccessTest("POST /api/tags/list", "/api/tags/list");
endpointSuccessTest("POST /api/monitors/find", "/api/monitors/find", { url: "https://example.com" });
endpointSuccessTest("POST /api/monitors/add", "/api/monitors/add", {
  monitor: { name: "Added", url: "https://example.com", type: "http" },
});
endpointSuccessTest("POST /api/monitors/edit", "/api/monitors/edit", {
  monitor_id: 1,
  monitor: { name: "Updated" },
});
endpointSuccessTest("POST /api/monitors/delete", "/api/monitors/delete", { monitor_id: 1 });
endpointSuccessTest("POST /api/monitors/status", "/api/monitors/status", { monitor_id: 1 });
endpointSuccessTest("POST /api/monitors/pause", "/api/monitors/pause", { monitor_id: 1 });
endpointSuccessTest("POST /api/monitors/resume", "/api/monitors/resume", { monitor_id: 1 });
endpointSuccessTest("POST /api/monitors/tags/set", "/api/monitors/tags/set", {
  monitor_id: 1,
  tags: ["#demo"],
  replace: true,
});
endpointSuccessTest("POST /api/monitors/tags/delete", "/api/monitors/tags/delete", {
  monitor_id: 1,
  tags: ["#demo"],
});
endpointSuccessTest("POST /api/notifications/list", "/api/notifications/list");
endpointSuccessTest("POST /api/notifications/add", "/api/notifications/add", {
  notification: { name: "Email" },
});
endpointSuccessTest("POST /api/notifications/edit", "/api/notifications/edit", {
  notification_id: 20,
  notification: { id: 20, name: "Email 2" },
});
endpointSuccessTest("POST /api/notifications/delete", "/api/notifications/delete", { notification_id: 20 });
endpointSuccessTest("POST /api/notifications/test", "/api/notifications/test", {
  notification: { name: "Email" },
});
endpointSuccessTest("POST /api/proxies/list", "/api/proxies/list");
endpointSuccessTest("POST /api/proxies/add", "/api/proxies/add", {
  proxy: { host: "proxy.local" },
});
endpointSuccessTest("POST /api/proxies/edit", "/api/proxies/edit", {
  proxy: { id: 30, host: "proxy2.local" },
});
endpointSuccessTest("POST /api/proxies/delete", "/api/proxies/delete", { proxy_id: 30 });
endpointSuccessTest("POST /api/status-pages/list", "/api/status-pages/list");
endpointSuccessTest("POST /api/status-pages/add", "/api/status-pages/add", {
  status_page: { title: "Status", slug: "status" },
});
endpointSuccessTest("POST /api/status-pages/save", "/api/status-pages/save", {
  status_page: { slug: "status", config: { title: "Status" }, publicGroupList: [] },
});
endpointSuccessTest("POST /api/status-pages/delete", "/api/status-pages/delete", { slug: "status" });
endpointSuccessTest("POST /api/tags/add", "/api/tags/add", {
  tag: { name: "#demo", color: "#ffffff" },
});
endpointSuccessTest("POST /api/tags/edit", "/api/tags/edit", {
  tag: { id: 10, name: "#demo2", color: "#000000" },
});
endpointSuccessTest("POST /api/tags/delete", "/api/tags/delete", { tag_id: 10 });
endpointSuccessTest("POST /api/settings/get", "/api/settings/get");
endpointSuccessTest("POST /api/settings/set", "/api/settings/set", {
  settings: { theme: "dark" },
});
endpointSuccessTest("POST /api/api-keys/list", "/api/api-keys/list");
endpointSuccessTest("POST /api/api-keys/add", "/api/api-keys/add", {
  api_key: { name: "Bridge Key" },
});
endpointSuccessTest("POST /api/api-keys/enable", "/api/api-keys/enable", { key_id: 60 });
endpointSuccessTest("POST /api/api-keys/disable", "/api/api-keys/disable", { key_id: 60 });
endpointSuccessTest("POST /api/api-keys/delete", "/api/api-keys/delete", { key_id: 60 });
endpointSuccessTest("POST /api/maintenances/list", "/api/maintenances/list");
endpointSuccessTest("POST /api/maintenances/add", "/api/maintenances/add", {
  maintenance: { title: "Window" },
});
endpointSuccessTest("POST /api/maintenances/edit", "/api/maintenances/edit", {
  maintenance: { id: 50, title: "Window 2" },
});
endpointSuccessTest("POST /api/maintenances/delete", "/api/maintenances/delete", { maintenance_id: 50 });
endpointSuccessTest("POST /api/monitors/sniff", "/api/monitors/sniff", { timeout: 1 });
endpointSuccessTest("POST /api/call", "/api/call", { method: "get_monitors" });
