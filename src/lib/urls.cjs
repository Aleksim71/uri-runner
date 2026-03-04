const fs = require("fs-extra");
const path = require("path");
const http = require("node:http");
const https = require("node:https");

function fetchOnce(url, { headers = {}, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;

    const req = lib.request(
      u,
      { method: "GET", headers },
      (res) => {
        res.resume();
        resolve({ statusCode: res.statusCode || 0, headers: res.headers || {} });
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function checkUrl({ url, expect = [200, 304], headers = {}, timeoutMs = 8000 }) {
  const started = Date.now();
  try {
    const res = await fetchOnce(url, { headers, timeoutMs });
    const ms = Date.now() - started;
    const ok = expect.includes(res.statusCode);
    return { url, status: res.statusCode, ok, ms };
  } catch (e) {
    const ms = Date.now() - started;
    return { url, status: 0, ok: false, ms, error: String(e && e.message ? e.message : e) };
  }
}

async function runUrlChecksPublic({ reportDir, baseUrl, list, expect = [200, 304] }) {
  const results = [];
  let ok = true;

  for (const item of list) {
    const p = typeof item === "string" ? item : item.path;
    const url = new URL(p, baseUrl).toString();
    const r = await checkUrl({ url, expect });
    results.push(r);
    if (!r.ok) ok = false;
  }

  const outPath = path.join(reportDir, "urls.public.json");
  await fs.writeJson(outPath, { ok, base_url: baseUrl, expect, results }, { spaces: 2 });

  return { ok, outPath, results };
}

module.exports = { runUrlChecksPublic };
