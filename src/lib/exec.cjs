const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

/**
 * Run a command and return { stdout, stderr, exitCode }.
 * Never throws for non-zero exit codes; callers decide.
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
    // execFile throws on non-zero exit codes
    const stdout = e && e.stdout ? String(e.stdout) : "";
    const stderr = e && e.stderr ? String(e.stderr) : (e && e.message ? String(e.message) : "");
    const code = typeof e.code === "number" ? e.code : 1;
    return { stdout, stderr, exitCode: code };
  }
}

module.exports = { runCmd };
