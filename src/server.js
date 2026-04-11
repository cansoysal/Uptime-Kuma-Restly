#!/usr/bin/env node

const path = require("node:path");
const process = require("node:process");
const express = require("express");
const { io } = require("socket.io-client");
const { authenticator } = require("otplib");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");

const baseDir = __dirname ? path.resolve(__dirname, "..") : process.cwd();
dotenv.config({ path: path.join(baseDir, ".env") });

const BRIDGE_HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const BRIDGE_PORT = Number.parseInt(process.env.BRIDGE_PORT || "9911", 10);
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || "").trim() || null;
const BRIDGE_LOG_LEVEL = (process.env.BRIDGE_LOG_LEVEL || "info").trim().toLowerCase();
const KUMA_URL = (process.env.KUMA_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const KUMA_USERNAME = process.env.KUMA_USERNAME || "";
const KUMA_PASSWORD = process.env.KUMA_PASSWORD || "";
const KUMA_2FA_SECRET = (process.env.KUMA_2FA_SECRET || "").trim() || null;
const KUMA_TIMEOUT = Number.parseInt(process.env.KUMA_TIMEOUT || "60", 10) * 1000;

function isDebugEnabled() {
  return BRIDGE_LOG_LEVEL === "debug";
}

function logDebug(...args) {
  if (isDebugEnabled()) {
    console.log("[bridge:debug]", ...args);
  }
}

function currentTotp() {
  if (!KUMA_2FA_SECRET) {
    throw new Error("KUMA_2FA_SECRET is not set");
  }
  return authenticator.generate(KUMA_2FA_SECRET);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stripUrl(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function snakeToCamel(value) {
  return String(value).replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function removeKeyVariants(target, key) {
  if (!target || typeof target !== "object") {
    return false;
  }

  const variants = new Set([key, snakeToCamel(key)]);
  let removed = false;
  for (const variant of variants) {
    if (Object.prototype.hasOwnProperty.call(target, variant)) {
      delete target[variant];
      removed = true;
    }
  }
  return removed;
}

function getMissingColumnName(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/no column named ([A-Za-z0-9_]+)/i);
  return match ? match[1] : null;
}

function normalizeMonitor(monitor) {
  const next = { ...monitor };

  if (Object.prototype.hasOwnProperty.call(next, "notifications")) {
    const notifications = next.notifications;
    delete next.notifications;
    if (Array.isArray(notifications)) {
      next.notificationIDList = Object.fromEntries(
        notifications.map((id) => [String(id), true]),
      );
    } else if (notifications && typeof notifications === "object") {
      next.notificationIDList = notifications;
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, "tags")) {
    next.tags = next.tags.map((tag) => {
      if (Number.isInteger(tag)) {
        return { id: tag, value: "" };
      }
      if (typeof tag === "string") {
        return { name: tag };
      }
      if (tag && typeof tag === "object") {
        if (Object.prototype.hasOwnProperty.call(tag, "id")) {
          return { id: tag.id, value: tag.value || "" };
        }
        return tag;
      }
      return tag;
    });
  }

  return next;
}

function normalizeNotification(notification) {
  return { ...notification };
}

function parseInteger(value, fieldName) {
  if (!Number.isInteger(value)) {
    throw new Error(`'${fieldName}' must be an integer`);
  }
  return value;
}

function parseRequiredObject(value, fieldName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`'${fieldName}' must be a non-empty object`);
  }
  return value;
}

function parseRequiredArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`'${fieldName}' must be an array`);
  }
  return value;
}

class KumaClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.cache = new Map();
    this.waiters = new Map();
    this.monitorsPrimed = false;
  }

  registerEvent(name) {
    this.socket.on(name, (...args) => {
      const payload = args.length === 1 ? args[0] : args;
      logDebug("socket event", name, Array.isArray(payload) ? `array(${payload.length})` : typeof payload);
      this.cache.set(name, payload);
      const waiters = this.waiters.get(name) || [];
      this.waiters.delete(name);
      for (const waiter of waiters) {
        waiter.resolve(payload);
      }
    });
  }

  async connect() {
    if (this.socket && this.connected) {
      return;
    }

    this.socket = io(KUMA_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      timeout: KUMA_TIMEOUT,
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const onConnect = () => {
        this.connected = true;
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const cleanup = () => {
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onError);
      };

      this.socket.once("connect", onConnect);
      this.socket.once("connect_error", onError);
    });

    this.socket.on("disconnect", () => {
      logDebug("socket disconnected");
      this.connected = false;
      this.monitorsPrimed = false;
    });

    for (const eventName of [
      "monitorList",
      "heartbeatList",
      "tagList",
      "notificationList",
      "proxyList",
      "maintenanceList",
      "statusPageList",
      "apiKeyList",
      "dockerHostList",
      "remoteBrowserList",
      "monitorTypeList",
      "toastError",
      "info",
    ]) {
      this.registerEvent(eventName);
    }

    await this.doLogin();
    this.monitorsPrimed = true;
    await this.waitFor("monitorList");
  }

  async disconnect() {
    if (!this.socket) {
      return;
    }
    this.socket.disconnect();
    this.connected = false;
    this.monitorsPrimed = false;
  }

  async ensureConnected() {
    if (!this.socket || !this.connected) {
      await this.connect();
      return;
    }
    if (!this.monitorsPrimed) {
      await this.waitFor("monitorList");
      this.monitorsPrimed = true;
    }
  }

  async doLogin() {
    if (!KUMA_USERNAME || !KUMA_PASSWORD) {
      logDebug("skipping login because KUMA_USERNAME or KUMA_PASSWORD is not set");
      return;
    }

    const initial = await this.call("login", {
      username: KUMA_USERNAME,
      password: KUMA_PASSWORD,
    });
    logDebug("initial login response", JSON.stringify(initial));

    if (initial?.ok) {
      this.invalidateLoginScopedCache();
      return;
    }

    if (initial?.tokenRequired) {
      if (!KUMA_2FA_SECRET) {
        throw new Error("Kuma requires 2FA but KUMA_2FA_SECRET is not set");
      }

      let lastResult = initial;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        lastResult = await this.call("login", {
          username: KUMA_USERNAME,
          password: KUMA_PASSWORD,
          token: currentTotp(),
        });
        logDebug(`2FA login attempt ${attempt + 1} response`, JSON.stringify(lastResult));
        if (lastResult?.ok) {
          this.invalidateLoginScopedCache();
          return;
        }
        if (attempt === 0) {
          const wait = 30 - (Math.floor(Date.now() / 1000) % 30) + 1;
          console.log(`[bridge] 2FA attempt 1 failed (${JSON.stringify(lastResult)}), waiting ${wait}s for next TOTP window...`);
          await sleep(wait * 1000);
        }
      }
      throw new Error(`2FA login failed after 2 attempts. Last response: ${JSON.stringify(lastResult)}`);
    }

    throw new Error(`Login failed. Response: ${JSON.stringify(initial)}`);
  }

  async call(eventName, ...payload) {
    await this.ensureConnectedShallow();
    logDebug("emit", eventName, payload.length > 0 ? JSON.stringify(payload) : "[]");
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`Timed out after ${KUMA_TIMEOUT}ms calling '${eventName}'`));
      }, KUMA_TIMEOUT);

      this.socket.emit(eventName, ...payload, (response) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        logDebug("ack", eventName, typeof response === "object" ? JSON.stringify(response) : String(response));
        resolve(response);
      });
    });
  }

  invalidateLoginScopedCache() {
    for (const key of [
      "monitorList",
      "heartbeatList",
      "tagList",
      "notificationList",
      "proxyList",
      "maintenanceList",
      "statusPageList",
      "apiKeyList",
      "dockerHostList",
      "remoteBrowserList",
      "monitorTypeList",
    ]) {
      this.cache.delete(key);
      this.waiters.delete(key);
    }
    this.monitorsPrimed = false;
    logDebug("cleared login-scoped cache");
  }

  async ensureConnectedShallow() {
    if (!this.socket || !this.connected) {
      await this.connect();
    }
  }

  waitFor(eventName, timeoutMs = KUMA_TIMEOUT) {
    if (this.cache.has(eventName)) {
      return Promise.resolve(this.cache.get(eventName));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.waiters.get(eventName) || [];
        this.waiters.set(
          eventName,
          waiters.filter((waiter) => waiter.resolve !== resolve),
        );
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for '${eventName}'`));
      }, timeoutMs);

      const waiter = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
      };
      const waiters = this.waiters.get(eventName) || [];
      waiters.push(waiter);
      this.waiters.set(eventName, waiters);
    });
  }

  async getMonitors() {
    await this.ensureConnected();
    this.cache.delete("monitorList");
    await this.call("getMonitorList");
    return this.waitFor("monitorList");
  }

  async getHeartbeatList() {
    await this.ensureConnected();
    return this.waitFor("heartbeatList");
  }

  getCachedList(cacheName) {
    const raw = this.cache.get(cacheName);
    if (Array.isArray(raw)) {
      return raw;
    }
    if (raw && typeof raw === "object") {
      return Object.values(raw);
    }
    return raw ?? [];
  }

  async getTags() {
    await this.ensureConnected();
    if (this.cache.has("tagList")) {
      return this.getCachedList("tagList");
    }
    const result = await this.call("getTags");
    const tags = Array.isArray(result) ? result : result?.tags || [];
    this.cache.set("tagList", tags);
    return tags;
  }

  async getNotifications() {
    await this.ensureConnected();
    return this.getCachedList("notificationList");
  }

  async getProxies() {
    await this.ensureConnected();
    return this.getCachedList("proxyList");
  }

  async getMaintenanceList() {
    await this.ensureConnected();
    this.cache.delete("maintenanceList");
    await this.call("getMaintenanceList");
    return this.waitFor("maintenanceList");
  }

  async getStatusPageList() {
    await this.ensureConnected();
    return this.getCachedList("statusPageList");
  }

  async getAPIKeyList() {
    await this.ensureConnected();
    this.cache.delete("apiKeyList");
    await this.call("getAPIKeyList");
    return this.waitFor("apiKeyList");
  }

  async getDockerHostList() {
    await this.ensureConnected();
    return this.getCachedList("dockerHostList");
  }

  async getRemoteBrowserList() {
    await this.ensureConnected();
    return this.getCachedList("remoteBrowserList");
  }

  async getMonitor(monitorId) {
    const monitors = await this.getMonitors();
    const monitor = monitors[String(monitorId)] || monitors[monitorId] || null;
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not found`);
    }
    return { id: monitorId, ...monitor };
  }

  async findMonitorByUrl(url) {
    const monitors = await this.getMonitors();
    const needle = stripUrl(url);
    for (const [monitorId, monitor] of Object.entries(monitors || {})) {
      if (stripUrl(monitor.url) === needle) {
        return { id: Number.parseInt(monitorId, 10), ...monitor };
      }
    }
    return null;
  }

  async ensureTagId(tag) {
    if (Number.isInteger(tag)) {
      return { id: tag, value: "" };
    }
    if (typeof tag === "string") {
      tag = { name: tag };
    }
    if (tag && typeof tag === "object" && Object.prototype.hasOwnProperty.call(tag, "id")) {
      return { id: tag.id, value: tag.value || "" };
    }

    const tags = await this.getTags();
    const name = tag?.name || "";
    const color = tag?.color || "#ffffff";
    const value = tag?.value || "";

    const existing = tags.find((item) => String(item.name || "").toLowerCase() === String(name).toLowerCase());
    if (existing) {
      return { id: existing.id, value };
    }

    const result = await this.call("addTag", { name, color });
    if (!result?.ok) {
      throw new Error(`addTag failed for '${name}': ${JSON.stringify(result)}`);
    }

    const tagList = [...tags, result.tag];
    this.cache.set("tagList", tagList);
    return { id: result.tag.id, value };
  }

  async applyMonitorTags(monitorId, resolvedTags, existingTags = []) {
    for (const tag of existingTags) {
      const tagId = tag.tagId || tag.tag_id || tag.id;
      if (tagId) {
        await this.call("deleteMonitorTag", tagId, monitorId, tag.value || "");
      }
    }
    for (const tag of resolvedTags) {
      const result = await this.call("addMonitorTag", tag.id, monitorId, tag.value || "");
      if (result && result.ok === false) {
        throw new Error(`addMonitorTag failed: ${JSON.stringify(result)}`);
      }
    }
  }

  monitorDefaults() {
    return {
      type: "http",
      name: "",
      description: null,
      url: "",
      method: "GET",
      hostname: null,
      port: null,
      maxretries: 3,
      weight: 2000,
      active: true,
      timeout: 48,
      interval: 60,
      retryInterval: 60,
      resendInterval: 0,
      keyword: "",
      invertKeyword: false,
      expiryNotification: false,
      ignoreTls: false,
      upsideDown: false,
      packetSize: 56,
      maxredirects: 10,
      accepted_statuscodes: ["200-299"],
      accepted_statuscodes_json: "[\"200-299\"]",
      dns_resolve_type: "A",
      dns_resolve_server: "1.1.1.1",
      dns_last_result: null,
      docker_container: "",
      docker_host: null,
      proxyId: null,
      notificationIDList: {},
      mqttTopic: "",
      mqttSuccessMessage: "",
      mqttCheckType: "keyword",
      databaseQuery: null,
      authMethod: null,
      grpcUrl: null,
      grpcProtobuf: null,
      grpcMethod: null,
      grpcServiceName: null,
      grpcEnableTls: false,
      radiusCalledStationId: null,
      radiusCallingStationId: null,
      game: null,
      gamedigGivenPortOnly: true,
      httpBodyEncoding: "json",
      jsonPath: null,
      expectedValue: null,
      kafkaProducerTopic: null,
      kafkaProducerBrokers: [],
      kafkaProducerSsl: false,
      kafkaProducerAllowAutoTopicCreation: false,
      kafkaProducerMessage: null,
      cacheBust: false,
      remote_browser: null,
      snmpOid: null,
      jsonPathOperator: "==",
      snmpVersion: "2c",
      smtpSecurity: null,
      rabbitmqNodes: null,
      conditions: [],
      ipFamily: null,
      ping_numeric: true,
      ping_count: 1,
      ping_per_request_timeout: 2,
      headers: null,
      body: null,
      grpcBody: null,
      grpcMetadata: null,
      basic_auth_user: null,
      basic_auth_pass: null,
      oauth_client_id: null,
      oauth_client_secret: null,
      oauth_token_url: null,
      oauth_scopes: null,
      oauth_audience: null,
      oauth_auth_method: "client_secret_basic",
      pushToken: null,
      databaseConnectionString: null,
      radiusUsername: null,
      radiusPassword: null,
      radiusSecret: null,
      mqttUsername: "",
      mqttPassword: "",
      mqttWebsocketPath: null,
      authWorkstation: null,
      authDomain: null,
      tlsCa: null,
      tlsCert: null,
      tlsKey: null,
      kafkaProducerSaslOptions: { mechanism: "None" },
      rabbitmqUsername: null,
      rabbitmqPassword: null,
    };
  }

  async retryWithoutMissingColumns(payload, run) {
    const working = { ...payload };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await run(working);
      } catch (error) {
        const missingColumn = getMissingColumnName(error);
        if (!missingColumn) {
          throw error;
        }

        const removed = removeKeyVariants(working, missingColumn);
        if (!removed) {
          throw error;
        }

        logDebug("retrying after removing unsupported monitor field", missingColumn);
      }
    }

    throw new Error("Unable to save monitor after removing unsupported fields");
  }

  async addMonitor(monitor) {
    const payload = { ...this.monitorDefaults(), ...monitor };
    const tags = payload.tags;
    delete payload.tags;
    const result = await this.retryWithoutMissingColumns(payload, async (safePayload) => {
      const response = await this.call("add", safePayload);
      if (response && response.ok === false) {
        throw new Error(`add failed: ${JSON.stringify(response)}`);
      }
      return response;
    });
    if (Array.isArray(tags) && result?.monitorID) {
      const resolved = [];
      for (const tag of tags) {
        resolved.push(await this.ensureTagId(tag));
      }
      await this.applyMonitorTags(result.monitorID, resolved, []);
    }
    return result;
  }

  async editMonitor(monitorId, monitor) {
    const monitors = await this.getMonitors();
    const existing = monitors[String(monitorId)] || monitors[monitorId] || {};
    const payload = { ...existing, ...monitor, id: monitorId };
    const tags = payload.tags;
    delete payload.tags;
    const result = await this.retryWithoutMissingColumns(payload, async (safePayload) => {
      const response = await this.call("editMonitor", safePayload);
      if (response && response.ok === false) {
        throw new Error(`editMonitor failed: ${JSON.stringify(response)}`);
      }
      return response;
    });
    if (Array.isArray(tags)) {
      const resolved = [];
      for (const tag of tags) {
        resolved.push(await this.ensureTagId(tag));
      }
      await this.applyMonitorTags(monitorId, resolved, existing.tags || []);
    }
    return result;
  }

  async deleteMonitor(monitorId) {
    const result = await this.call("deleteMonitor", monitorId);
    if (result && result.ok === false) {
      throw new Error(`deleteMonitor failed: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async pauseMonitor(monitorId) {
    const result = await this.call("pauseMonitor", monitorId);
    if (result && result.ok === false) {
      throw new Error(`pauseMonitor failed: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async resumeMonitor(monitorId) {
    const result = await this.call("resumeMonitor", monitorId);
    if (result && result.ok === false) {
      throw new Error(`resumeMonitor failed: ${JSON.stringify(result)}`);
    }
    return result;
  }

  async getHeartbeats(monitorId) {
    const heartbeats = await this.getHeartbeatList();
    if (heartbeats && typeof heartbeats === "object") {
      return heartbeats[String(monitorId)] || heartbeats[monitorId] || {};
    }
    return heartbeats;
  }

  async setMonitorTags(monitorId, tags, replace = false) {
    const resolved = [];
    for (const tag of tags) {
      resolved.push(await this.ensureTagId(tag));
    }

    const result = { deleted: [], added: [] };
    if (replace) {
      const monitors = await this.getMonitors();
      const existing = monitors[String(monitorId)] || monitors[monitorId] || {};
      for (const tag of existing.tags || []) {
        const tagId = tag.tagId || tag.tag_id || tag.id;
        if (!tagId) {
          continue;
        }
        const response = await this.call("deleteMonitorTag", tagId, monitorId, tag.value || "");
        result.deleted.push({ tagId, result: response });
      }
    }

    for (const tag of resolved) {
      const response = await this.call("addMonitorTag", tag.id, monitorId, tag.value || "");
      if (response && response.ok === false) {
        throw new Error(`addMonitorTag failed: ${JSON.stringify(response)}`);
      }
      result.added.push({ tagId: tag.id, result: response });
    }
    return result;
  }

  async removeMonitorTags(monitorId, tags) {
    const resolvedIds = new Set();
    for (const tag of tags) {
      const resolved = await this.ensureTagId(tag);
      resolvedIds.add(resolved.id);
    }

    const monitors = await this.getMonitors();
    const existing = monitors[String(monitorId)] || monitors[monitorId] || {};
    const result = { deleted: [] };
    for (const tag of existing.tags || []) {
      const tagId = tag.tagId || tag.tag_id || tag.id;
      if (!resolvedIds.has(tagId)) {
        continue;
      }
      const response = await this.call("deleteMonitorTag", tagId, monitorId, tag.value || "");
      result.deleted.push({ tagId, result: response });
    }
    return result;
  }

  async sniffNextAdd(timeoutSeconds = 60) {
    await this.ensureConnected();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.socket.off("add", onAdd);
        resolve(null);
      }, timeoutSeconds * 1000);

      const onAdd = (...args) => {
        clearTimeout(timer);
        this.socket.off("add", onAdd);
        resolve(args.length === 1 ? args[0] : args);
      };
      this.socket.on("add", onAdd);
    });
  }

  async getListLike(eventName, cacheName = null) {
    await this.ensureConnected();
    const event = cacheName || eventName;
    if (this.cache.has(event)) {
      return this.cache.get(event);
    }
    return this.call(eventName);
  }

  async genericCall(eventName, ...payload) {
    await this.ensureConnected();
    return this.call(eventName, ...payload);
  }
}

class KumaPool {
  constructor() {
    this.client = new KumaClient();
    this.connecting = null;
  }

  async connect() {
    if (this.connecting) {
      return this.connecting;
    }
    this.connecting = this.client
      .connect()
      .then(() => {
        console.log("[bridge] Kuma connection established.");
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  async get() {
    if (!this.client.connected) {
      console.log("[bridge] Kuma socket disconnected — reconnecting...");
      await this.connect();
    } else {
      await this.client.ensureConnected();
    }
    return this.client;
  }

  async disconnect() {
    await this.client.disconnect();
  }
}

const pool = new KumaPool();
const app = express();
const api = express.Router();
app.use(express.json({ limit: "1mb" }));

function authMiddleware(req, res, next) {
  const publicPaths = new Set([
    "/health",
    "/api/health",
    "/api/openapi.json",
    "/docs",
    "/docs/",
  ]);

  if (publicPaths.has(req.path) || req.path.startsWith("/docs/")) {
    next();
    return;
  }

  if (!BRIDGE_TOKEN) {
    next();
    return;
  }
  const header = req.header("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ ok: false, error: "Missing Authorization: Bearer <token>" });
    return;
  }
  const token = header.slice(7).trim();
  if (token !== BRIDGE_TOKEN) {
    res.status(403).json({ ok: false, error: "Invalid token" });
    return;
  }
  next();
}

app.use(authMiddleware);

function healthHandler(_req, res) {
  res.json({
    ok: true,
    ts: Math.floor(Date.now() / 1000),
    kuma_url: KUMA_URL,
    kuma_connected: pool.client.connected,
    timeout: KUMA_TIMEOUT / 1000,
    "2fa": Boolean(KUMA_2FA_SECRET),
  });
}

function parseMonitorId(value) {
  if (!Number.isInteger(value)) {
    throw new Error("'monitor_id' must be an integer");
  }
  return value;
}

function findById(list, id, fieldName) {
  const numericId = parseInteger(id, fieldName);
  return (list || []).find((item) => Number(item?.id) === numericId) || null;
}

const METHOD_MAP = {
  get_monitors: async (client) => client.getMonitors(),
  get_monitor: async (client, body, args, kwargs) => client.getMonitor(kwargs.monitor_id ?? kwargs.id ?? body.monitor_id ?? args[0]),
  add_monitor: async (client, body, _args, kwargs) => {
    const monitor = Object.keys(kwargs).length > 0 ? kwargs : body.monitor || {};
    return client.addMonitor(normalizeMonitor(monitor));
  },
  edit_monitor: async (client, body, args, kwargs) => {
    const monitorId = kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0];
    const monitor = Object.keys(kwargs).length > 0 && !("monitor_id" in kwargs) && !("id" in kwargs) ? kwargs : body.monitor || {};
    return client.editMonitor(parseInteger(monitorId, "monitor_id"), normalizeMonitor(monitor));
  },
  delete_monitor: async (client, body, args, kwargs) => client.deleteMonitor(parseInteger(kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0], "monitor_id")),
  pause_monitor: async (client, body, args, kwargs) => client.pauseMonitor(parseInteger(kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0], "monitor_id")),
  resume_monitor: async (client, body, args, kwargs) => client.resumeMonitor(parseInteger(kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0], "monitor_id")),
  get_monitor_beats: async (client, body, args, kwargs) => client.genericCall("getMonitorBeats", parseInteger(kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0], "monitor_id"), kwargs.period ?? body.period ?? args[1] ?? 24),
  get_monitor_status: async (client, body, args, kwargs) => client.getHeartbeats(parseInteger(kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0], "monitor_id")),
  get_heartbeats: async (client) => client.getHeartbeatList(),
  get_notifications: async (client) => client.getNotifications(),
  get_notification: async (client, body, args, kwargs) => findById(await client.getNotifications(), kwargs.id ?? kwargs.notification_id ?? body.notification_id ?? args[0], "notification_id"),
  test_notification: async (client, body, _args, kwargs) => client.genericCall("testNotification", normalizeNotification(Object.keys(kwargs).length > 0 ? kwargs : body.notification)),
  add_notification: async (client, body, _args, kwargs) => client.genericCall("addNotification", normalizeNotification(Object.keys(kwargs).length > 0 ? kwargs : body.notification), null),
  edit_notification: async (client, body, _args, kwargs) => {
    const notification = normalizeNotification(Object.keys(kwargs).length > 0 ? kwargs : body.notification);
    const notificationId = body.notification_id ?? kwargs.notification_id ?? kwargs.id;
    return client.genericCall("addNotification", notification, notificationId);
  },
  delete_notification: async (client, body, args, kwargs) => client.genericCall("deleteNotification", kwargs.id ?? kwargs.notification_id ?? body.notification_id ?? args[0]),
  check_apprise: async (client) => client.genericCall("checkApprise"),
  get_proxies: async (client) => client.getProxies(),
  get_proxy: async (client, body, args, kwargs) => findById(await client.getProxies(), kwargs.id ?? kwargs.proxy_id ?? body.proxy_id ?? args[0], "proxy_id"),
  add_proxy: async (client, body, _args, kwargs) => client.genericCall("addProxy", Object.keys(kwargs).length > 0 ? kwargs : body.proxy, null),
  edit_proxy: async (client, body, _args, kwargs) => {
    const proxy = Object.keys(kwargs).length > 0 ? kwargs : body.proxy;
    const proxyId = body.proxy_id ?? kwargs.proxy_id ?? kwargs.id ?? proxy?.id;
    return client.genericCall("addProxy", proxy, proxyId);
  },
  delete_proxy: async (client, body, args, kwargs) => client.genericCall("deleteProxy", kwargs.id ?? kwargs.proxy_id ?? body.proxy_id ?? args[0]),
  get_status_pages: async (client) => client.getStatusPageList(),
  get_status_page: async (client, body, args, kwargs) => client.genericCall("getStatusPage", kwargs.slug ?? kwargs.id ?? body.slug ?? body.status_page_slug ?? args[0]),
  add_status_page: async (client, body, _args, kwargs) => {
    const statusPage = Object.keys(kwargs).length > 0 ? kwargs : body.status_page || body;
    return client.genericCall("addStatusPage", statusPage.title, statusPage.slug);
  },
  delete_status_page: async (client, body, args, kwargs) => client.genericCall("deleteStatusPage", kwargs.slug ?? kwargs.id ?? body.slug ?? body.status_page_slug ?? args[0]),
  save_status_page: async (client, body, _args, kwargs) => {
    const statusPage = Object.keys(kwargs).length > 0 ? kwargs : body.status_page || body;
    return client.genericCall(
      "saveStatusPage",
      statusPage.slug ?? body.slug,
      statusPage.config ?? statusPage,
      statusPage.imgDataUrl ?? null,
      statusPage.publicGroupList ?? [],
    );
  },
  post_incident: async (client, body, _args, kwargs) => {
    const incident = body.incident || kwargs.incident || body;
    const slug = kwargs.slug ?? body.slug ?? body.status_page_slug;
    return client.genericCall("postIncident", slug, incident);
  },
  unpin_incident: async (client, body, args, kwargs) => client.genericCall("unpinIncident", kwargs.slug ?? body.slug ?? body.status_page_slug ?? args[0]),
  avg_ping: async (client, body, _args, kwargs) => client.genericCall("avgPing", Object.keys(kwargs).length > 0 ? kwargs : body),
  cert_info: async (client, body, _args, kwargs) => client.genericCall("certInfo", Object.keys(kwargs).length > 0 ? kwargs : body),
  uptime: async (client, body, _args, kwargs) => client.genericCall("uptime", Object.keys(kwargs).length > 0 ? kwargs : body),
  info: async (client) => client.genericCall("info"),
  clear_events: async (client, body, args, kwargs) => client.genericCall("clearEvents", kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0]),
  clear_heartbeats: async (client, body, args, kwargs) => client.genericCall("clearHeartbeats", kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0]),
  clear_statistics: async (client, body, args, kwargs) => client.genericCall("clearStatistics", kwargs.id ?? kwargs.monitor_id ?? body.monitor_id ?? args[0]),
  get_tags: async (client) => client.getTags(),
  get_tag: async (client, body, args, kwargs) => findById(await client.getTags(), kwargs.id ?? kwargs.tag_id ?? body.tag_id ?? args[0], "tag_id"),
  add_tag: async (client, body, _args, kwargs) => client.genericCall("addTag", Object.keys(kwargs).length > 0 ? kwargs : body.tag || body),
  edit_tag: async (client, body, _args, kwargs) => client.genericCall("editTag", Object.keys(kwargs).length > 0 ? kwargs : body.tag || body),
  delete_tag: async (client, body, args, kwargs) => client.genericCall("deleteTag", kwargs.id ?? kwargs.tag_id ?? body.tag_id ?? args[0]),
  get_settings: async (client) => client.genericCall("getSettings"),
  set_settings: async (client, body, _args, kwargs) => client.genericCall("setSettings", Object.keys(kwargs).length > 0 ? kwargs : body.settings || body),
  change_password: async (client, body, _args, kwargs) => client.genericCall("changePassword", Object.keys(kwargs).length > 0 ? kwargs : body),
  upload_backup: async (client, body, _args, kwargs) => client.genericCall("uploadBackup", Object.keys(kwargs).length > 0 ? kwargs : body),
  twofa_status: async (client) => client.genericCall("twoFAStatus"),
  prepare_2fa: async (client) => client.genericCall("prepare2FA"),
  verify_token: async (client, body, _args, kwargs) => client.genericCall("verifyToken", Object.keys(kwargs).length > 0 ? kwargs : body),
  save_2fa: async (client, body, _args, kwargs) => client.genericCall("save2FA", Object.keys(kwargs).length > 0 ? kwargs : body),
  disable_2fa: async (client, body, _args, kwargs) => client.genericCall("disable2FA", Object.keys(kwargs).length > 0 ? kwargs : body),
  login: async (client, body, _args, kwargs) => client.genericCall("login", Object.keys(kwargs).length > 0 ? kwargs : body),
  login_by_token: async (client, body, _args, kwargs) => client.genericCall("loginByToken", Object.keys(kwargs).length > 0 ? kwargs : body),
  logout: async (client) => client.genericCall("logout"),
  need_setup: async (client) => client.genericCall("needSetup"),
  setup: async (client, body, _args, kwargs) => client.genericCall("setup", Object.keys(kwargs).length > 0 ? kwargs : body),
  get_database_size: async (client) => client.genericCall("getDatabaseSize"),
  shrink_database: async (client) => client.genericCall("shrinkDatabase"),
  get_docker_hosts: async (client) => client.getDockerHostList(),
  get_docker_host: async (client, body, args, kwargs) => findById(await client.getDockerHostList(), kwargs.id ?? kwargs.docker_host_id ?? body.docker_host_id ?? args[0], "docker_host_id"),
  test_docker_host: async (client, body, _args, kwargs) => client.genericCall("testDockerHost", Object.keys(kwargs).length > 0 ? kwargs : body.docker_host || body),
  add_docker_host: async (client, body, _args, kwargs) => client.genericCall("addDockerHost", Object.keys(kwargs).length > 0 ? kwargs : body.docker_host || body, null),
  edit_docker_host: async (client, body, _args, kwargs) => {
    const dockerHost = Object.keys(kwargs).length > 0 ? kwargs : body.docker_host || body;
    const dockerHostId = body.docker_host_id ?? kwargs.docker_host_id ?? kwargs.id ?? dockerHost?.id;
    return client.genericCall("addDockerHost", dockerHost, dockerHostId);
  },
  delete_docker_host: async (client, body, args, kwargs) => client.genericCall("deleteDockerHost", kwargs.id ?? kwargs.docker_host_id ?? body.docker_host_id ?? args[0]),
  get_maintenances: async (client) => client.getMaintenanceList(),
  get_maintenance: async (client, body, args, kwargs) => client.genericCall("getMaintenance", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  add_maintenance: async (client, body, _args, kwargs) => client.genericCall("addMaintenance", Object.keys(kwargs).length > 0 ? kwargs : body.maintenance || body),
  edit_maintenance: async (client, body, _args, kwargs) => client.genericCall("editMaintenance", Object.keys(kwargs).length > 0 ? kwargs : body.maintenance || body),
  delete_maintenance: async (client, body, args, kwargs) => client.genericCall("deleteMaintenance", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  pause_maintenance: async (client, body, args, kwargs) => client.genericCall("pauseMaintenance", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  resume_maintenance: async (client, body, args, kwargs) => client.genericCall("resumeMaintenance", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  get_monitor_maintenance: async (client, body, args, kwargs) => client.genericCall("getMonitorMaintenance", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  add_monitor_maintenance: async (client, body, _args, kwargs) => {
    const maintenanceId = kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? body.id;
    const monitors = kwargs.monitors ?? body.monitors ?? [];
    return client.genericCall("addMonitorMaintenance", maintenanceId, monitors);
  },
  get_status_page_maintenance: async (client, body, args, kwargs) => client.genericCall("getMaintenanceStatusPage", kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? args[0]),
  add_status_page_maintenance: async (client, body, _args, kwargs) => {
    const maintenanceId = kwargs.id ?? kwargs.maintenance_id ?? body.maintenance_id ?? body.id;
    const statusPages = kwargs.status_pages ?? kwargs.statusPages ?? body.status_pages ?? body.statusPages ?? [];
    return client.genericCall("addMaintenanceStatusPage", maintenanceId, statusPages);
  },
  get_api_keys: async (client) => client.getAPIKeyList(),
  get_api_key: async (client, body, args, kwargs) => findById(await client.getAPIKeyList(), kwargs.id ?? kwargs.key_id ?? body.key_id ?? args[0], "key_id"),
  add_api_key: async (client, body, _args, kwargs) => client.genericCall("addAPIKey", Object.keys(kwargs).length > 0 ? kwargs : body.api_key || body),
  enable_api_key: async (client, body, args, kwargs) => client.genericCall("enableAPIKey", kwargs.id ?? kwargs.key_id ?? body.key_id ?? args[0]),
  disable_api_key: async (client, body, args, kwargs) => client.genericCall("disableAPIKey", kwargs.id ?? kwargs.key_id ?? body.key_id ?? args[0]),
  delete_api_key: async (client, body, args, kwargs) => client.genericCall("deleteAPIKey", kwargs.id ?? kwargs.key_id ?? body.key_id ?? args[0]),
  get_game_list: async (client) => client.genericCall("getGameList"),
  test_chrome: async (client, body, _args, kwargs) => client.genericCall("testChrome", Object.keys(kwargs).length > 0 ? kwargs : body),
};

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        trace: error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 15).join("\n") : undefined,
      });
    }
  };
}

api.get("/health", healthHandler);

api.post("/monitors/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await client.getMonitors() });
}));

api.post("/tags/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await client.getTags() });
}));

api.post("/monitors/find", asyncRoute(async (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!url) {
    res.status(400).json({ ok: false, error: "'url' is required" });
    return;
  }
  const client = await pool.get();
  const monitor = await client.findMonitorByUrl(url);
  if (!monitor) {
    res.status(404).json({ ok: false, error: `No monitor found with url: ${url}` });
    return;
  }
  res.json({ ok: true, result: monitor });
}));

api.post("/monitors/add", asyncRoute(async (req, res) => {
  const monitor = req.body?.monitor;
  if (!monitor || typeof monitor !== "object" || Array.isArray(monitor)) {
    res.status(400).json({ ok: false, error: "'monitor' must be a non-empty object" });
    return;
  }
  const client = await pool.get();
  res.json({ ok: true, result: await client.addMonitor(normalizeMonitor(monitor)) });
}));

api.post("/monitors/edit", asyncRoute(async (req, res) => {
  const monitor = req.body?.monitor;
  if (!monitor || typeof monitor !== "object" || Array.isArray(monitor)) {
    res.status(400).json({ ok: false, error: "'monitor' must be a non-empty object" });
    return;
  }
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const client = await pool.get();
  res.json({ ok: true, result: await client.editMonitor(monitorId, normalizeMonitor(monitor)) });
}));

api.post("/monitors/delete", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const client = await pool.get();
  res.json({ ok: true, result: await client.deleteMonitor(monitorId) });
}));

api.post("/monitors/status", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const client = await pool.get();
  res.json({ ok: true, result: await client.getHeartbeats(monitorId) });
}));

api.post("/monitors/pause", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const client = await pool.get();
  res.json({ ok: true, result: await client.pauseMonitor(monitorId) });
}));

api.post("/monitors/resume", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const client = await pool.get();
  res.json({ ok: true, result: await client.resumeMonitor(monitorId) });
}));

api.post("/monitors/tags/set", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const tags = req.body?.tags;
  if (!Array.isArray(tags)) {
    res.status(400).json({ ok: false, error: "'tags' must be an array" });
    return;
  }
  const client = await pool.get();
  res.json({ ok: true, result: await client.setMonitorTags(monitorId, tags, Boolean(req.body?.replace)) });
}));

api.post("/monitors/tags/delete", asyncRoute(async (req, res) => {
  const monitorId = parseMonitorId(req.body?.monitor_id);
  const tags = req.body?.tags;
  if (!Array.isArray(tags)) {
    res.status(400).json({ ok: false, error: "'tags' must be an array" });
    return;
  }
  const client = await pool.get();
  res.json({ ok: true, result: await client.removeMonitorTags(monitorId, tags) });
}));

api.post("/notifications/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_notifications(client, {}, [], {}) });
}));

api.post("/notifications/add", asyncRoute(async (req, res) => {
  const notification = parseRequiredObject(req.body?.notification, "notification");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_notification(client, { notification }, [], {}) });
}));

api.post("/notifications/edit", asyncRoute(async (req, res) => {
  const notification = parseRequiredObject(req.body?.notification, "notification");
  const notificationId = parseInteger(req.body?.notification_id, "notification_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.edit_notification(client, { notification, notification_id: notificationId }, [], {}) });
}));

api.post("/notifications/delete", asyncRoute(async (req, res) => {
  const notificationId = parseInteger(req.body?.notification_id, "notification_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_notification(client, { notification_id: notificationId }, [], {}) });
}));

api.post("/notifications/test", asyncRoute(async (req, res) => {
  const notification = parseRequiredObject(req.body?.notification, "notification");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.test_notification(client, { notification }, [], {}) });
}));

api.post("/proxies/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_proxies(client, {}, [], {}) });
}));

api.post("/proxies/add", asyncRoute(async (req, res) => {
  const proxy = parseRequiredObject(req.body?.proxy, "proxy");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_proxy(client, { proxy }, [], {}) });
}));

api.post("/proxies/edit", asyncRoute(async (req, res) => {
  const proxy = parseRequiredObject(req.body?.proxy, "proxy");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.edit_proxy(client, { proxy }, [], {}) });
}));

api.post("/proxies/delete", asyncRoute(async (req, res) => {
  const proxyId = parseInteger(req.body?.proxy_id, "proxy_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_proxy(client, { proxy_id: proxyId }, [], {}) });
}));

api.post("/status-pages/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_status_pages(client, {}, [], {}) });
}));

api.post("/status-pages/add", asyncRoute(async (req, res) => {
  const statusPage = parseRequiredObject(req.body?.status_page, "status_page");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_status_page(client, { status_page: statusPage }, [], {}) });
}));

api.post("/status-pages/save", asyncRoute(async (req, res) => {
  const statusPage = parseRequiredObject(req.body?.status_page, "status_page");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.save_status_page(client, { status_page: statusPage }, [], {}) });
}));

api.post("/status-pages/delete", asyncRoute(async (req, res) => {
  const slug = req.body?.slug || req.body?.status_page_slug;
  if (!slug) {
    res.status(400).json({ ok: false, error: "'slug' is required" });
    return;
  }
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_status_page(client, { slug }, [], {}) });
}));

api.post("/tags/add", asyncRoute(async (req, res) => {
  const tag = parseRequiredObject(req.body?.tag, "tag");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_tag(client, { tag }, [], {}) });
}));

api.post("/tags/edit", asyncRoute(async (req, res) => {
  const tag = parseRequiredObject(req.body?.tag, "tag");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.edit_tag(client, { tag }, [], {}) });
}));

api.post("/tags/delete", asyncRoute(async (req, res) => {
  const tagId = parseInteger(req.body?.tag_id, "tag_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_tag(client, { tag_id: tagId }, [], {}) });
}));

api.post("/settings/get", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_settings(client, {}, [], {}) });
}));

api.post("/settings/set", asyncRoute(async (req, res) => {
  const settings = parseRequiredObject(req.body?.settings, "settings");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.set_settings(client, { settings }, [], {}) });
}));

api.post("/api-keys/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_api_keys(client, {}, [], {}) });
}));

api.post("/api-keys/add", asyncRoute(async (req, res) => {
  const apiKey = parseRequiredObject(req.body?.api_key, "api_key");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_api_key(client, { api_key: apiKey }, [], {}) });
}));

api.post("/api-keys/enable", asyncRoute(async (req, res) => {
  const keyId = parseInteger(req.body?.key_id, "key_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.enable_api_key(client, { key_id: keyId }, [], {}) });
}));

api.post("/api-keys/disable", asyncRoute(async (req, res) => {
  const keyId = parseInteger(req.body?.key_id, "key_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.disable_api_key(client, { key_id: keyId }, [], {}) });
}));

api.post("/api-keys/delete", asyncRoute(async (req, res) => {
  const keyId = parseInteger(req.body?.key_id, "key_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_api_key(client, { key_id: keyId }, [], {}) });
}));

api.post("/maintenances/list", asyncRoute(async (_req, res) => {
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.get_maintenances(client, {}, [], {}) });
}));

api.post("/maintenances/add", asyncRoute(async (req, res) => {
  const maintenance = parseRequiredObject(req.body?.maintenance, "maintenance");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.add_maintenance(client, { maintenance }, [], {}) });
}));

api.post("/maintenances/edit", asyncRoute(async (req, res) => {
  const maintenance = parseRequiredObject(req.body?.maintenance, "maintenance");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.edit_maintenance(client, { maintenance }, [], {}) });
}));

api.post("/maintenances/delete", asyncRoute(async (req, res) => {
  const maintenanceId = parseInteger(req.body?.maintenance_id, "maintenance_id");
  const client = await pool.get();
  res.json({ ok: true, result: await METHOD_MAP.delete_maintenance(client, { maintenance_id: maintenanceId }, [], {}) });
}));

api.post("/monitors/sniff", asyncRoute(async (req, res) => {
  const timeout = Number.parseInt(String(req.body?.timeout || "60"), 10);
  const client = await pool.get();
  const payload = await client.sniffNextAdd(timeout);
  if (!payload) {
    res.status(408).json({
      ok: false,
      error: `No add event seen within ${timeout}s. Try adding a monitor via the Kuma UI while this request is waiting.`,
    });
    return;
  }
  res.json({ ok: true, captured_payload: payload });
}));

api.post("/call", asyncRoute(async (req, res) => {
  const method = req.body?.method;
  const args = Array.isArray(req.body?.args) ? req.body.args : [];
  const kwargs = req.body?.kwargs && typeof req.body.kwargs === "object" ? req.body.kwargs : {};
  if (!method) {
    res.status(400).json({ ok: false, error: "Missing 'method'" });
    return;
  }

  const client = await pool.get();
  const handler = METHOD_MAP[method];
  if (!handler) {
    res.status(400).json({ ok: false, error: `Unsupported method: ${method}` });
    return;
  }

  const result = await handler(client, req.body || {}, args, kwargs);
  res.json({ ok: true, result });
}));

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Uptime Kuma Restly API",
    version: "0.1.0",
    description: "Uptime Kuma Restly exposes a REST API over Uptime Kuma's internal Socket.IO API.",
  },
  servers: [
    { url: "/api", description: "Uptime Kuma Restly API root" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
    schemas: {
      OkResult: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          result: {},
        },
      },
      ErrorResult: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          error: { type: "string" },
          trace: { type: "string" },
        },
      },
    },
  },
  security: BRIDGE_TOKEN ? [{ bearerAuth: [] }] : [],
  paths: {
    "/health": {
      get: {
        summary: "Bridge health",
        responses: {
          200: {
            description: "Bridge health response",
          },
        },
      },
    },
    "/monitors/list": {
      post: {
        summary: "List monitors",
        responses: { 200: { description: "Monitor list" } },
      },
    },
    "/monitors/find": {
      post: {
        summary: "Find monitor by URL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { url: { type: "string" } },
                required: ["url"],
              },
            },
          },
        },
        responses: { 200: { description: "Matching monitor" } },
      },
    },
    "/monitors/add": {
      post: {
        summary: "Add monitor",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  monitor: { type: "object" },
                },
                required: ["monitor"],
              },
            },
          },
        },
        responses: { 200: { description: "Add monitor result" } },
      },
    },
    "/monitors/edit": {
      post: {
        summary: "Edit monitor",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  monitor_id: { type: "integer" },
                  monitor: { type: "object" },
                },
                required: ["monitor_id", "monitor"],
              },
            },
          },
        },
        responses: { 200: { description: "Edit monitor result" } },
      },
    },
    "/monitors/delete": {
      post: {
        summary: "Delete monitor",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { monitor_id: { type: "integer" } },
                required: ["monitor_id"],
              },
            },
          },
        },
        responses: { 200: { description: "Delete monitor result" } },
      },
    },
    "/notifications/list": {
      post: { summary: "List notifications", responses: { 200: { description: "Notification list" } } },
    },
    "/notifications/add": {
      post: {
        summary: "Add notification",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { notification: { type: "object" } },
                required: ["notification"],
              },
            },
          },
        },
        responses: { 200: { description: "Add notification result" } },
      },
    },
    "/proxies/list": {
      post: { summary: "List proxies", responses: { 200: { description: "Proxy list" } } },
    },
    "/status-pages/list": {
      post: { summary: "List status pages", responses: { 200: { description: "Status page list" } } },
    },
    "/tags/list": {
      post: { summary: "List tags", responses: { 200: { description: "Tag list" } } },
    },
    "/settings/get": {
      post: { summary: "Get settings", responses: { 200: { description: "Settings" } } },
    },
    "/api-keys/list": {
      post: { summary: "List API keys", responses: { 200: { description: "API key list" } } },
    },
    "/maintenances/list": {
      post: { summary: "List maintenances", responses: { 200: { description: "Maintenance list" } } },
    },
    "/call": {
      post: {
        summary: "Compatibility method dispatch",
        description: "Dispatches a broader method surface mapped from the documented uptime-kuma-api wrapper.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  method: { type: "string" },
                  args: { type: "array", items: {} },
                  kwargs: { type: "object" },
                },
                required: ["method"],
              },
            },
          },
        },
        responses: { 200: { description: "Method result" } },
      },
    },
  },
};

app.get("/health", healthHandler);
app.use("/api", api);
app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  swaggerOptions: {
    url: "/api/openapi.json",
  },
}));
app.use("/", api);

let server;

async function start() {
  console.log(`[bridge] Listening  : http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  console.log(`[bridge] Kuma URL   : ${KUMA_URL}`);
  console.log(`[bridge] Timeout    : ${KUMA_TIMEOUT / 1000}s`);
  console.log(`[bridge] Auth token : ${BRIDGE_TOKEN ? "set" : "NONE (open access)"}`);
  console.log(`[bridge] 2FA        : ${KUMA_2FA_SECRET ? "enabled (otplib)" : "disabled"}`);

  server = app.listen(BRIDGE_PORT, BRIDGE_HOST);
  pool.connect().catch((error) => {
    console.warn("[bridge] Initial Kuma connection failed; the bridge will stay up and retry on demand.");
    console.warn(error);
  });
}

async function shutdown(signal) {
  console.log(`\n[bridge] Shutting down on ${signal}...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.disconnect();
  console.log("[bridge] Bye.");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

module.exports = {
  app,
  pool,
  METHOD_MAP,
  openApiSpec,
  start,
  shutdown,
};

if (require.main === module) {
  start().catch((error) => {
    console.error("[bridge] Fatal startup error:", error);
    process.exit(1);
  });
}
