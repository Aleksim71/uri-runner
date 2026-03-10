const fs = require("fs-extra");
const path = require("path");
const { runCmd } = require("../system/exec.cjs");

/**
 * Run checks defined in runbook.audit.checks.
 * Returns { ok, results } where each result includes stdout/stderr paths and exitCode.
 */
async function runChecks({ cwd, reportDir, checks }) {
  const results = [];
  let ok = true;

  for (const check of checks) {
    const checkNameSafe = check.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const outPath = path.join(reportDir, `checks.${checkNameSafe}.out.log`);
    const errPath = path.join(reportDir, `checks.${checkNameSafe}.err.log`);

    const checkCwd = check.cwd ? path.resolve(cwd, check.cwd) : cwd;
    const env = check.env ? { ...process.env, ...check.env } : process.env;

    const res = await runCmd(check.cmd, check.args || [], { cwd: checkCwd, env });

    await fs.writeFile(outPath, res.stdout ?? "", "utf8");
    await fs.writeFile(errPath, res.stderr ?? "", "utf8");

    const entry = {
      name: check.name,
      cmd: check.cmd,
      args: check.args || [],
      cwd: check.cwd || ".",
      exitCode: res.exitCode,
      out: path.relative(path.dirname(reportDir), outPath).replace(/\\/g, "/"),
      err: path.relative(path.dirname(reportDir), errPath).replace(/\\/g, "/"),
    };

    results.push(entry);

    if (res.exitCode !== 0) ok = false;
  }

  return { ok, results };
}

module.exports = { runChecks };
