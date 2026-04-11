#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const docsFile = path.join(repoRoot, "docs", "UPTIME-KUMA-SOCKET-SNAPSHOT.md");
const defaultSource = "/tmp/uptime-kuma-official";
const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : defaultSource;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function extractSocketEventsFromSource(rootDir) {
  const files = [
    path.join(rootDir, "server", "server.js"),
    path.join(rootDir, "server", "socket-handlers", "general-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "proxy-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "maintenance-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "api-key-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "status-page-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "docker-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "remote-browser-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "database-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "chart-socket-handler.js"),
    path.join(rootDir, "server", "socket-handlers", "cloudflared-socket-handler.js"),
  ];

  const events = [];
  const literalRegex = /socket\.on\(\s*"([^"]+)"/g;
  const prefixRegex = /const\s+prefix\s*=\s*"([^"]+)"/;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const content = readFile(file);
    let match;
    while ((match = literalRegex.exec(content)) !== null) {
      events.push(match[1]);
    }

    if (file.endsWith("cloudflared-socket-handler.js")) {
      const prefixMatch = content.match(prefixRegex);
      const prefix = prefixMatch ? prefixMatch[1] : "cloudflared";
      for (const suffix of ["join", "leave", "start", "stop", "removeToken"]) {
        events.push(`${prefix}${suffix}`);
      }
    }
  }

  return uniqueSorted(events);
}

function extractPushEventsFromClient(rootDir) {
  const clientFile = path.join(rootDir, "server", "client.js");
  const serverFile = path.join(rootDir, "server", "uptime-kuma-server.js");
  const statusPageModelFile = path.join(rootDir, "server", "model", "status_page.js");
  const results = [];
  const emitRegex = /emit\(\s*"([^"]+)"/g;

  for (const file of [clientFile, serverFile, statusPageModelFile]) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const content = readFile(file);
    let match;
    while ((match = emitRegex.exec(content)) !== null) {
      results.push(match[1]);
    }
  }

  return uniqueSorted(results.filter((name) => /List$|^info$/.test(name)));
}

function extractDocumentedBullets(markdown, heading) {
  const headingMarker = `## ${heading}`;
  const start = markdown.indexOf(headingMarker);
  if (start === -1) {
    return [];
  }
  const sectionStart = start + headingMarker.length;
  const nextHeading = markdown.indexOf("\n## ", sectionStart);
  const section = markdown.slice(sectionStart, nextHeading === -1 ? undefined : nextHeading);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `") && line.endsWith("`"))
    .map((line) => line.slice(3, -1));
}

function normalizeDocumentedEventNames(values) {
  return uniqueSorted(
    values.map((value) => {
      const index = value.indexOf("(");
      return index === -1 ? value : value.slice(0, index);
    }),
  );
}

function diffLists(actual, documented) {
  const actualSet = new Set(actual);
  const documentedSet = new Set(documented);
  const missingFromDocs = actual.filter((item) => !documentedSet.has(item));
  const missingFromSource = documented.filter((item) => !actualSet.has(item));
  return { missingFromDocs, missingFromSource };
}

if (!fs.existsSync(sourceRoot)) {
  fail(`Uptime Kuma source directory not found: ${sourceRoot}\nClone it locally first, for example:\n  git clone --depth 1 https://github.com/louislam/uptime-kuma.git ${defaultSource}`);
}

if (!fs.existsSync(docsFile)) {
  fail(`Snapshot doc not found: ${docsFile}`);
}

const doc = readFile(docsFile);
const actualSocketEvents = extractSocketEventsFromSource(sourceRoot);
const actualPushEvents = extractPushEventsFromClient(sourceRoot);
const documentedSocketEvents = normalizeDocumentedEventNames(
  extractDocumentedBullets(doc, "Current Authenticated Socket Handlers From Official Source"),
);
const documentedPushEvents = normalizeDocumentedEventNames(
  extractDocumentedBullets(doc, "Current Server-Pushed List Events Observed In Official Source"),
);

const socketDiff = diffLists(actualSocketEvents, documentedSocketEvents);
const pushDiff = diffLists(actualPushEvents, documentedPushEvents);

console.log("Uptime Kuma socket snapshot check");
console.log(`Source: ${sourceRoot}`);
console.log(`Snapshot: ${docsFile}`);
console.log("");
console.log(`Socket handlers in source: ${actualSocketEvents.length}`);
console.log(`Socket handlers in docs:   ${documentedSocketEvents.length}`);
console.log(`Push events in source:     ${actualPushEvents.length}`);
console.log(`Push events in docs:       ${documentedPushEvents.length}`);

function printDiff(title, items) {
  if (items.length === 0) {
    console.log(`${title}: none`);
    return;
  }
  console.log(`${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

console.log("");
printDiff("Socket events missing from docs", socketDiff.missingFromDocs);
printDiff("Socket events documented but not found in source", socketDiff.missingFromSource);
printDiff("Push events missing from docs", pushDiff.missingFromDocs);
printDiff("Push events documented but not found in source", pushDiff.missingFromSource);

const hasDiff =
  socketDiff.missingFromDocs.length > 0 ||
  socketDiff.missingFromSource.length > 0 ||
  pushDiff.missingFromDocs.length > 0 ||
  pushDiff.missingFromSource.length > 0;

process.exit(hasDiff ? 2 : 0);
