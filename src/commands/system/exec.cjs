const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

/**
 * Low-level runner.
 * Returns { stdout, stderr, exitCode } and never throws on non-zero exit codes.
 */
async function runCmd(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      ...opts,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (e) {
    const stdout = e && e.stdout ? String(e.stdout) : "";
    const stderr = e && e.stderr ? String(e.stderr) : (e && e.message ? String(e.message) : "");
    const code = typeof e.code === "number" ? e.code : 1;
    return { stdout, stderr, exitCode: code };
  }
}

/**
 * Scenario command handler.
 * Expects:
 * {
 *   cmd: "pwd",
 *   args: [],
 *   opts: { cwd: "/path" }
 * }
 */
async function execCommand(input = {}, _context = {}) {
  const cmd =
    input && typeof input.cmd === "string" && input.cmd.trim().length > 0
      ? input.cmd.trim()
      : "";

  const argv = Array.isArray(input?.args)
    ? input.args.map((v) => String(v))
    : [];

  const opts =
    input && input.opts && typeof input.opts === "object" && !Array.isArray(input.opts)
      ? { ...input.opts }
      : {};

  if (!cmd) {
    return {
      stdout: "",
      stderr: 'system.exec: "cmd" is required',
      exitCode: 1,
    };
  }

  return runCmd(cmd, argv, opts);
}

module.exports = execCommand;
module.exports.runCmd = runCmd;
module.exports.execCommand = execCommand;
