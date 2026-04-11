# Uptime Kuma Socket Snapshot

Snapshot date: 2026-04-11

Official source used for this snapshot:

- `louislam/uptime-kuma`
- Local snapshot path used during extraction: `/tmp/uptime-kuma-official`

Primary files inspected:

- `/tmp/uptime-kuma-official/server/server.js`
- `/tmp/uptime-kuma-official/server/client.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/general-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/proxy-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/maintenance-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/api-key-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/status-page-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/docker-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/remote-browser-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/database-socket-handler.js`
- `/tmp/uptime-kuma-official/server/socket-handlers/chart-socket-handler.js`

This document is the authoritative mapping basis for this bridge. It intentionally takes precedence over older third-party wrapper docs when they disagree.

Current server-pushed list events observed in official source

- `monitorList`
- `heartbeatList`
- `notificationList`
- `proxyList`
- `maintenanceList`
- `statusPageList`
- `apiKeyList`
- `dockerHostList`
- `remoteBrowserList`
- `monitorTypeList`
- `info`

Current authenticated socket handlers from official source

Auth and setup
- `login(data, callback)`
- `loginByToken(token, callback)`
- `logout(callback)`
- `prepare2FA(currentPassword, callback)`
- `save2FA(currentPassword, callback)`
- `disable2FA(currentPassword, callback)`
- `verifyToken(token, currentPassword, callback)`
- `twoFAStatus(callback)`
- `needSetup(callback)`
- `setup(username, password, callback)`

Monitors
- `add(monitor, callback)`
- `editMonitor(monitor, callback)`
- `getMonitorList(callback)`
- `getMonitor(monitorID, callback)`
- `checkDomain(partial, callback)`
- `getMonitorBeats(monitorID, period, callback)`
- `resumeMonitor(monitorID, callback)`
- `pauseMonitor(monitorID, callback)`
- `deleteMonitor(monitorID, deleteChildren, callback)`
- `monitorImportantHeartbeatListCount(monitorID, callback)`
- `monitorImportantHeartbeatListPaged(monitorID, offset, count, callback)`

Tags
- `getTags(callback)`
- `addTag(tag, callback)`
- `editTag(tag, callback)`
- `deleteTag(tagID, callback)`
- `addMonitorTag(tagID, monitorID, value, callback)`
- `editMonitorTag(tagID, monitorID, value, callback)`
- `deleteMonitorTag(tagID, monitorID, value, callback)`

Notifications
- `addNotification(notification, notificationID, callback)`
- `deleteNotification(notificationID, callback)`
- `testNotification(notification, callback)`
- `checkApprise(callback)`

Settings and maintenance
- `changePassword(password, callback)`
- `getSettings(callback)`
- `setSettings(data, currentPassword, callback)`
- `addMaintenance(maintenance, callback)`
- `editMaintenance(maintenance, callback)`
- `addMonitorMaintenance(maintenanceID, monitors, callback)`
- `addMaintenanceStatusPage(maintenanceID, statusPages, callback)`
- `getMaintenance(maintenanceID, callback)`
- `getMaintenanceList(callback)`
- `getMonitorMaintenance(maintenanceID, callback)`
- `getMaintenanceStatusPage(maintenanceID, callback)`
- `deleteMaintenance(maintenanceID, callback)`
- `pauseMaintenance(maintenanceID, callback)`
- `resumeMaintenance(maintenanceID, callback)`

Status pages and incidents
- `postIncident(slug, incident, callback)`
- `unpinIncident(slug, callback)`
- `getIncidentHistory(slug, cursor, callback)`
- `editIncident(slug, incidentID, incident, callback)`
- `deleteIncident(slug, incidentID, callback)`
- `resolveIncident(slug, incidentID, callback)`
- `getStatusPage(slug, callback)`
- `saveStatusPage(slug, config, imgDataUrl, publicGroupList, callback)`
- `addStatusPage(title, slug, callback)`
- `deleteStatusPage(slug, callback)`

Proxies, docker, browsers, API keys
- `addProxy(proxy, proxyID, callback)`
- `deleteProxy(proxyID, callback)`
- `addDockerHost(dockerHost, dockerHostID, callback)`
- `deleteDockerHost(dockerHostID, callback)`
- `testDockerHost(dockerHost, callback)`
- `addRemoteBrowser(remoteBrowser, remoteBrowserID, callback)`
- `deleteRemoteBrowser(dockerHostID, callback)`
- `testRemoteBrowser(remoteBrowser, callback)`
- `addAPIKey(key, callback)`
- `getAPIKeyList(callback)`
- `deleteAPIKey(keyID, callback)`
- `disableAPIKey(keyID, callback)`
- `enableAPIKey(keyID, callback)`

General and diagnostics
- `initServerTimezone(timezone)`
- `getGameList(callback)`
- `testChrome(executable, callback)`
- `getPushExample(language, callback)`
- `disconnectOtherSocketClients()`
- `getDatabaseSize(callback)`
- `shrinkDatabase(callback)`
- `getMonitorChartData(monitorID, period, callback)`

Bridge alignment notes

- This bridge now uses the current official event names above instead of older wrapper-style names like `getAPIKeys`, `getMaintenances`, or `getStatusPages`.
- The bridge caller now supports multi-argument Socket.IO calls, which is required for current official handlers such as:
  - `addNotification(notification, notificationID, callback)`
  - `addProxy(proxy, proxyID, callback)`
  - `addDockerHost(dockerHost, dockerHostID, callback)`
  - `postIncident(slug, incident, callback)`
  - `saveStatusPage(slug, config, imgDataUrl, publicGroupList, callback)`

