"use strict";

/**
 * MVP Doctor (1–2 checks):
 * 1) Ensure cwd exists and has package.json
 * 2) If package.json has scripts.test — optionally run `npm test`
 *
 * Exit codes:
 * 0  OK
 * 10 cwd missing
 * 11 package.json missing
 * 12 npm test failed
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function runNpmTest(cwd) {
  const res = spawnSync("npm", ["test"], {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  // If npm couldn't spawn, status is null
  if (res.status === null) {
    return { ok: false, code: 12, reason: "npm spawn failed" };
  }

  if (res.status !== 0) {
    return { ok: false, code: 12, reason: `npm test exit ${res.status}` };
  }

  return { ok: true, code: 0 };
}

async function runDoctor({ cwd, runTests = false }) {
  console.log("[doctor] cwd:", cwd);

  if (!exists(cwd)) {
    console.error("[doctor] FAIL: cwd does not exist");
    return { ok: false, exitCode: 10 };
  }

  const pkgPath = path.join(cwd, "package.json");
  if (!exists(pkgPath)) {
    console.error("[doctor] FAIL: package.json not found");
    return { ok: false, exitCode: 11 };
  }

  let pkg;
  try {
    pkg = readJson(pkgPath);
  } catch (e) {
    console.error("[doctor] FAIL: package.json is not valid JSON");
    return { ok: false, exitCode: 11 };
  }

  const hasTest = Boolean(pkg?.scripts?.test);
  console.log("[doctor] package.json:", "OK");
  console.log("[doctor] scripts.test:", hasTest ? "YES" : "NO");

  if (runTests) {
    if (!hasTest) {
      console.log("[doctor] skip tests: scripts.test not found");
    } else {
      console.log("[doctor] running: npm test");
      const t = runNpmTest(cwd);
      if (!t.ok) {
        console.error("[doctor] FAIL:", t.reason);
        return { ok: false, exitCode: t.code };
      }
      console.log("[doctor] tests: OK");
    }
  } else {
    console.log("[doctor] hint: run with --tests to execute `npm test` (if available)");
  }

  console.log("[doctor] OK");
  return { ok: true, exitCode: 0 };
}

module.exports = { runDoctor };
