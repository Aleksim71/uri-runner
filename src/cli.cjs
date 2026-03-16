if (cmd === "replay") {
  const runId = process.argv[3];

  if (!runId) {
    console.error("usage: uri replay <runId>");
    process.exit(1);
  }

  const result = await replayRun({
    uramRoot,
    project: process.argv[4],
    runId,
    workspaceDir: null,
  });

  console.log(JSON.stringify(result.outboxPayload, null, 2));
}
