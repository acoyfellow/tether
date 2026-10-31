import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const provider = process.env["GEN_PROVIDER"];
if (!provider) throw new Error("GEN_PROVIDER required");

const API_ROOT = ["https:", "", "api.cloudflare.com", "client", "v4"].join("/");
const TOOL = `You are writing the arguments for one call to the tool below. You do not run it. The harness runs it.

Tool: execute
Runs JavaScript against the Cloudflare API. In scope: accountId (string) and cloudflare.request({ method, path, body }) which calls ${API_ROOT} + path and returns the parsed result field. Return the result of the write.
Argument changes: Field-level changes for the write operation. Each entry: key (field name), before (current value, omit for creates), after (new value, omit for deletes). Values must be strings. Example: [{"key":"content","before":"1.2.3.4","after":"5.6.7.8"},{"key":"proxied","after":"true"}]
Reply with only the call arguments as a JSON object {"code": string, "changes": array}. No prose, no code fence.`;

const KV = "79cfce90b4ab46a3a72350e734d697b5";
const tasks: { task: string; request: (n: number) => string }[] = [
  { task: "kv_rename", request: (n) => `Rename the KV namespace with id ${KV} to the title "gl-probe-kv-${n}".` },
  { task: "script_tags", request: (n) => `Set the tags on Worker script "gl-sb-${n + 1}" to exactly "team-${n}" and "tier-${n}".` },
  { task: "script_logpush", request: (n) => `Turn Logpush ${n % 2 ? "off" : "on"} for Worker script "gl-sb-${n + 1}".` },
  { task: "cron", request: (n) => `Set the cron schedule of Worker script "gl-sb-${n + 1}" to "${n + 1} * * * *".` },
];

const directory = mkdtempSync(join(tmpdir(), "rbm-"));
const writes: unknown[] = [];
const rejected: unknown[] = [];
for (const { task, request } of tasks) {
  for (let n = 0; n < 5; n += 1) {
    const prompt = join(directory, `${task}-${n}.md`);
    writeFileSync(prompt, `${TOOL}\n\nUser request: ${request(n)}\n`);
    const output = execFileSync("pi", ["-p", "-ns", "--provider", provider, "--model", "claude-haiku-5-5", "--tools", "read", `@${prompt}`], { encoding: "utf8" });
    const text = output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
    try {
      const parsed = JSON.parse(text) as { code: string; changes: unknown[] };
      if (typeof parsed.code !== "string" || !Array.isArray(parsed.changes)) throw new Error("shape");
      writes.push({ id: `${task}-${n}`, task, request: request(n), ...parsed });
    } catch {
      rejected.push({ id: `${task}-${n}`, output });
    }
    console.log(task, n, writes.length, rejected.length);
  }
}
writeFileSync(new URL("./writes.json", import.meta.url), `${JSON.stringify({ writes, rejected }, null, 2)}\n`);
