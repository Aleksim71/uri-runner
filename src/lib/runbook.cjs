const fs = require("fs-extra");
const YAML = require("yaml");
const { z } = require("zod");

// ------------------------------
// Schemas
// ------------------------------
const CheckSchema = z.object({
  name: z.string().min(1),
  cmd: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional(), // relative to project root (runner cwd)
  env: z.record(z.string()).optional(),
});

const ServerSchema = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional(),
  base_url: z.string().url(),
  readiness: z
    .object({
      type: z.literal("http").default("http"),
      path: z.string().default("/health"),
      timeout_ms: z.number().int().positive().default(8000),
      interval_ms: z.number().int().positive().default(200),
    })
    .optional()
    .default({}),
});

const UrlItemSchema = z.union([z.string().min(1), z.object({ path: z.string().min(1) })]);

const UrlGroupSchema = z.object({
  base_url: z.string().url(),
  list: z.array(UrlItemSchema).default([]),
});

const UrlAuthLoginSchema = z
  .object({
    type: z.literal("form"),
    path: z.string().min(1),
    method: z.enum(["POST", "GET"]).default("POST"),
    fields: z.record(z.string()).default({}),
  })
  .optional();

const UrlAuthSchema = z
  .object({
    base_url: z.string().url(),
    login: UrlAuthLoginSchema,
    list: z.array(UrlItemSchema).default([]),
  })
  .optional();

const UrlsSchema = z
  .object({
    expect: z.array(z.number().int().positive()).optional().default([200, 304]),
    public: UrlGroupSchema.optional(),
    auth: UrlAuthSchema, // reserved for Step7
  })
  .optional();

const AuditSchema = z
  .object({
    checks: z.array(CheckSchema).optional().default([]),
    server: ServerSchema.optional(),
    urls: UrlsSchema,
  })
  .optional();

const RunbookSchema = z.object({
  version: z.literal(1),
  audit: AuditSchema,
  patch: z.any().optional(),
  execution: z.any().optional(),
});

// ------------------------------
// Parser
// ------------------------------
async function readRunbook(runbookPath) {
  const text = await fs.readFile(runbookPath, "utf8");
  const parsed = YAML.parse(text);

  const res = RunbookSchema.safeParse(parsed);
  if (!res.success) {
    const msg = res.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    const err = new Error(`RUNBOOK_INVALID: ${msg}`);
    err.code = "RUNBOOK_INVALID";
    throw err;
  }
  return res.data;
}

module.exports = { readRunbook };
