const fs = require("fs-extra");
const YAML = require("yaml");
const { z } = require("zod");

const CheckSchema = z.object({
  name: z.string().min(1),
  cmd: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional(), // relative to project root (runner cwd)
  env: z.record(z.string()).optional(),
});

const RunbookSchema = z.object({
  version: z.literal(1),
  project: z
    .object({
      root: z.string().optional(),
      config: z.string().optional(),
    })
    .optional(),
  audit: z
    .object({
      checks: z.array(CheckSchema).optional().default([]),
    })
    .optional(),
  patch: z.any().optional(),
  execution: z.any().optional(),
});

async function readRunbook(runbookPath) {
  const text = await fs.readFile(runbookPath, "utf8");
  const parsed = YAML.parse(text);

  const res = RunbookSchema.safeParse(parsed);
  if (!res.success) {
    const msg = res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    const err = new Error(`RUNBOOK.yaml invalid: ${msg}`);
    err.code = "RUNBOOK_INVALID";
    throw err;
  }
  return res.data;
}

module.exports = { readRunbook };
