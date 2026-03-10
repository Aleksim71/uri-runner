const path = require("path");
const { runWatchInboxOnce } = require("../uram/watch-inbox-once.cjs");

function printHelp() {
  console.log(`uri - URI Runner V2

Usage:
  uri --help
  uri watch-inbox-once [--root <path>]

Commands:
  watch-inbox-once   Run watcher once against configured folders

Options:
  --help             Show this help message
  --root <path>      Override URAM root
`);
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

async function main(argv = process.argv.slice(2)) {
  const args = Array.isArray(argv) ? argv : [];

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const command = args[0];

  if (command === "watch-inbox-once") {
    const rootArg = readArgValue(args, "--root");
    const uramRoot = rootArg ? path.resolve(rootArg) : process.cwd();

    await runWatchInboxOnce({ uramRoot });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

module.exports = { main };
