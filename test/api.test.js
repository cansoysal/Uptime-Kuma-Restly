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

function endpointRequestSuccessTest(name, path, options = {}) {
  test(name, async () => {
    const result = await request(path, options);
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

test("GET /api/monitors requires auth when token is configured", async () => {
  const result = await request("/api/monitors", { method: "GET", auth: false });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.ok, false);
});

test("GET /api/monitors rejects invalid bearer tokens", async () => {
  const result = await request("/api/monitors", {
    method: "GET",
    headers: { authorization: "Bearer wrong-token" },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.ok, false);
});

test("GET /api/monitors/by-url validates required url", async () => {
  const result = await request("/api/monitors/by-url", { method: "GET" });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors validates required monitor", async () => {
  const result = await request("/api/monitors", { body: {} });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
});

test("POST /api/monitors validates type-specific required fields", async () => {
  const result = await request("/api/monitors", {
    body: {
      type: "keyword", url: "https://example.com",
    },
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error, /requires field\(s\): keyword/);
});

test("POST /api/monitors auto-generates a push token", async () => {
  const result = await request("/api/monitors", {
    body: {
      type: "push", name: "Passive monitor",
    },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.result.monitor.pushToken, "string");
  assert.equal(result.body.result.monitor.pushToken.length, 32);
});

test("PATCH /api/monitors/:id validates the merged monitor payload", async () => {
  const result = await request("/api/monitors/1", {
    method: "PATCH",
    body: {
      type: "docker",
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

endpointRequestSuccessTest("GET /api/monitors", "/api/monitors", { method: "GET" });
endpointRequestSuccessTest("GET /api/monitors/by-url", "/api/monitors/by-url?url=https%3A%2F%2Fexample.com", { method: "GET" });
endpointRequestSuccessTest("POST /api/monitors", "/api/monitors", {
  body: { name: "Added", url: "https://example.com", type: "http" },
});
endpointRequestSuccessTest("PATCH /api/monitors/:id", "/api/monitors/1", {
  method: "PATCH",
  body: { name: "Updated" },
});
endpointRequestSuccessTest("DELETE /api/monitors/:id", "/api/monitors/1", { method: "DELETE" });
endpointRequestSuccessTest("GET /api/monitors/:id/status", "/api/monitors/1/status", { method: "GET" });
endpointRequestSuccessTest("POST /api/monitors/:id/pause", "/api/monitors/1/pause");
endpointRequestSuccessTest("POST /api/monitors/:id/resume", "/api/monitors/1/resume");
endpointRequestSuccessTest("PUT /api/monitors/:id/tags", "/api/monitors/1/tags", {
  method: "PUT",
  body: { tags: ["#demo"], replace: true },
});
endpointRequestSuccessTest("DELETE /api/monitors/:id/tags", "/api/monitors/1/tags", {
  method: "DELETE",
  body: { tags: ["#demo"] },
});
endpointRequestSuccessTest("GET /api/notifications", "/api/notifications", { method: "GET" });
endpointRequestSuccessTest("POST /api/notifications", "/api/notifications", {
  body: { name: "Email" },
});
endpointRequestSuccessTest("PATCH /api/notifications/:id", "/api/notifications/20", {
  method: "PATCH",
  body: { id: 20, name: "Email 2" },
});
endpointRequestSuccessTest("DELETE /api/notifications/:id", "/api/notifications/20", { method: "DELETE" });
endpointRequestSuccessTest("POST /api/notifications/:id/test", "/api/notifications/20/test", {
  body: { name: "Email" },
});
endpointRequestSuccessTest("GET /api/proxies", "/api/proxies", { method: "GET" });
endpointRequestSuccessTest("POST /api/proxies", "/api/proxies", {
  body: { host: "proxy.local" },
});
endpointRequestSuccessTest("PATCH /api/proxies/:id", "/api/proxies/30", {
  method: "PATCH",
  body: { host: "proxy2.local" },
});
endpointRequestSuccessTest("DELETE /api/proxies/:id", "/api/proxies/30", { method: "DELETE" });
endpointRequestSuccessTest("GET /api/status-pages", "/api/status-pages", { method: "GET" });
endpointRequestSuccessTest("POST /api/status-pages", "/api/status-pages", {
  body: { title: "Status", slug: "status" },
});
endpointRequestSuccessTest("PUT /api/status-pages/:slug", "/api/status-pages/status", {
  method: "PUT",
  body: { config: { title: "Status" }, publicGroupList: [] },
});
endpointRequestSuccessTest("DELETE /api/status-pages/:slug", "/api/status-pages/status", { method: "DELETE" });
endpointRequestSuccessTest("GET /api/tags", "/api/tags", { method: "GET" });
endpointRequestSuccessTest("POST /api/tags", "/api/tags", {
  body: { name: "#demo", color: "#ffffff" },
});
endpointRequestSuccessTest("PATCH /api/tags/:id", "/api/tags/10", {
  method: "PATCH",
  body: { name: "#demo2", color: "#000000" },
});
endpointRequestSuccessTest("DELETE /api/tags/:id", "/api/tags/10", { method: "DELETE" });
endpointRequestSuccessTest("GET /api/settings", "/api/settings", { method: "GET" });
endpointRequestSuccessTest("PATCH /api/settings", "/api/settings", {
  method: "PATCH",
  body: { theme: "dark" },
});
endpointRequestSuccessTest("GET /api/api-keys", "/api/api-keys", { method: "GET" });
endpointRequestSuccessTest("POST /api/api-keys", "/api/api-keys", {
  body: { name: "Bridge Key" },
});
endpointRequestSuccessTest("POST /api/api-keys/:id/enable", "/api/api-keys/60/enable");
endpointRequestSuccessTest("POST /api/api-keys/:id/disable", "/api/api-keys/60/disable");
endpointRequestSuccessTest("DELETE /api/api-keys/:id", "/api/api-keys/60", { method: "DELETE" });
endpointRequestSuccessTest("GET /api/maintenances", "/api/maintenances", { method: "GET" });
endpointRequestSuccessTest("POST /api/maintenances", "/api/maintenances", {
  body: { title: "Window" },
});
endpointRequestSuccessTest("PATCH /api/maintenances/:id", "/api/maintenances/50", {
  method: "PATCH",
  body: { title: "Window 2" },
});
endpointRequestSuccessTest("DELETE /api/maintenances/:id", "/api/maintenances/50", { method: "DELETE" });

endpointSuccessTest("POST /api/monitors/sniff", "/api/monitors/sniff", { timeout: 1 });
endpointSuccessTest("POST /api/call", "/api/call", { method: "get_monitors" });
