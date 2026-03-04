#!/usr/bin/env node
/**
 * Patch uri-runner: keep audit.server alive until URL checks complete.
 *
 * Symptom:
 * - readiness.json is OK
 * - urls.public.json shows ECONNREFUSED
 *
 * Cause:
 * Audit stops the server right after readiness, before URL checks run.
 *
 * This script performs safe, idempotent text edits on src/lib/audit.cjs.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(process.cwd(), "src/lib/audit.cjs");
if (!fs.existsSync(filePath)) {
  console.error("[patch] src/lib/audit.cjs not found:", filePath);
  process.exit(2);
}

let s = fs.readFileSync(filePath, "utf8");
const original = s;

function ensureStartedServerVar() {
  if (s.includes("let startedServer = null;")) return;

  // Insert right after serverErrAbs declaration if present.
  const re1 = /let\s+serverErrAbs\s*=\s*null;\s*\n/;
  if (re1.test(s)) {
    s = s.replace(re1, (m) => m + "let startedServer = null;\n");
    return;
  }

  // Fallback: insert after readinessAbs if present.
  const re2 = /let\s+readinessAbs\s*=\s*null;\s*\n/;
  if (re2.test(s)) {
    s = s.replace(re2, (m) => m + "let startedServer = null;\n");
  }
}

function captureStartedServer() {
  if (s.includes("startedServer = started;")) return;

  // After "const started = await startServer(...);"
  const re = /(const\s+started\s*=\s*await\s+startServer\s*\([\s\S]*?\);\s*\n)/m;
  if (re.test(s)) {
    s = s.replace(re, (m) => m + "startedServer = started;\n");
  }
}

function removeEarlyStop() {
  // Remove the early stop call inside the readiness block.
  if (!s.includes("await stopServer(")) return;

  s = s.replace(/^\s*await\s+stopServer\(\s*started\.child\s*\);\s*\n/gm, "");
  s = s.replace(/^\s*await\s+stopServer\(\s*startedServer\.child\s*\);\s*\n/gm, "");
}

function addLateStop() {
  // Add stop right before the successful return in try block.
  const markerRe =
    /(step\("outbox\.write",\s*true[\s\S]*?\);\s*\n)(\s*return\s+\{\s*exitCode,\s*runId\s*\};\s*\n)/m;

  if (!markerRe.test(s)) return;

  if (s.includes("Stop server at the very end") || s.includes("startedServer?.child")) return;

  s = s.replace(markerRe, (_m, p1, p2) => {
    return (
      p1 +
      "\n// Stop server at the very end (best-effort).\n" +
      "if (startedServer?.child) {\n" +
      "  try { await stopServer(startedServer.child); } catch (_) {}\n" +
      "}\n\n" +
      p2
    );
  });
}

ensureStartedServerVar();
captureStartedServer();
removeEarlyStop();
addLateStop();

if (s === original) {
  console.log("[patch] No changes needed (already patched or pattern not found).");
  process.exit(0);
}

fs.writeFileSync(filePath, s, "utf8");
console.log("[patch] Updated:", filePath);
