import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Change = { key: string; before?: string; after?: string };
type Write = { id: string; task: string; code: string; changes: Change[] };
type Fault = "honest" | "never_applied" | "wrong_value" | "overwritten";

const run = process.argv[2];
const token = process.env["CF_TOKEN"];
const accountId = process.env["CF_ACCOUNT"];
if (!run || !token || !accountId) throw new Error("usage: CF_TOKEN=.. CF_ACCOUNT=.. bun run.ts <run>");

const ROOT = "https://api.cloudflare.com/client/v4";
const { writes } = JSON.parse(readFileSync(new URL("./writes.json", import.meta.url), "utf8")) as { writes: Write[] };
const directory = new URL(`./runs/${run}/`, import.meta.url);
mkdirSync(directory, { recursive: true });

type Request = { method?: string; path: string; body?: unknown };
type Client = { request: (request: Request) => Promise<unknown> };

async function live(request: Request): Promise<{ status: number; result: unknown }> {
  const response = await fetch(`${ROOT}${request.path}`, {
    method: request.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  const parsed = (await response.json().catch(() => ({}))) as { result?: unknown };
  return { status: response.status, result: parsed.result ?? null };
}

function execute(code: string, client: Client): Promise<unknown> {
  const body = new Function("accountId", "cloudflare", `return (async () => { ${code} })();`);
  return body(accountId, client) as Promise<unknown>;
}

async function firstPath(code: string): Promise<string | null> {
  const seen: string[] = [];
  const recorder: Client = { request: async (request) => (seen.push(request.path), null) };
  await execute(code, recorder).catch(() => undefined);
  return seen[0] ?? null;
}

function literals(change: Change): string[] {
  if (change.after === undefined) return [];
  try {
    const parsed = JSON.parse(change.after) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [change.after];
}

function bumpDigit(value: string): string {
  const match = value.match(/\d(?=\D*$)/);
  if (!match || match.index === undefined) return `${value}x`;
  const digit = (Number(match[0]) + 1) % 10;
  return `${value.slice(0, match.index)}${digit}${value.slice(match.index + 1)}`;
}

function mutated(write: Write): string {
  let code = write.code;
  for (const value of write.changes.flatMap(literals)) {
    const swap = value === "true" ? "false" : value === "false" ? "true" : bumpDigit(value);
    code = code.split(value).join(swap);
  }
  return code;
}

async function apply(code: string): Promise<number[]> {
  const statuses: number[] = [];
  await execute(code, {
    request: async (request) => {
      const response = await live(request);
      statuses.push(response.status);
      return response.result;
    },
  }).catch(() => statuses.push(0));
  return statuses;
}

const accepted = (statuses: number[]) => statuses.length > 0 && statuses.every((status) => status >= 200 && status < 300);

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function holds(key: string, after: string, observed: unknown): boolean {
  if (Array.isArray(observed)) {
    if (text(observed) === after) return true;
    return observed.some((item) => text(item) === after || (item !== null && typeof item === "object" && text((item as Record<string, unknown>)[key]) === after));
  }
  if (observed === null || typeof observed !== "object") return false;
  const record = observed as Record<string, unknown>;
  if (key in record) return text(record[key]) === after;
  return Object.values(record).some((child) => child !== null && typeof child === "object" && holds(key, after, child));
}

const faults: Fault[] = ["never_applied", "wrong_value", "overwritten"];
for (const [index, write] of writes.entries()) {
  const faulty = faults[index % faults.length] as Fault;
  for (const fault of ["honest", faulty] as Fault[]) {
    const wrong = mutated(write);
    const reset = await apply(wrong);
    const real = fault === "honest" || fault === "overwritten" ? await apply(write.code) : [];
    const after = fault === "wrong_value" || fault === "overwritten" ? await apply(wrong) : [];
    const setup = { reset_ok: accepted(reset), write_ok: fault === "honest" || fault === "overwritten" ? accepted(real) : null, fault_ok: after.length ? accepted(after) : null };

    const path = await firstPath(write.code);
    const started = performance.now();
    const read = path ? await live({ path }) : { status: 0, result: null };
    const ms = performance.now() - started;
    const derivable = path !== null && read.status >= 200 && read.status < 300;
    const fields = write.changes
      .filter((change) => change.after !== undefined)
      .map((change) => ({ key: change.key, expected: change.after, held: holds(change.key, change.after as string, read.result) }));
    const verdict = fields.length > 0 && fields.every((field) => field.held) ? "held" : "broken";
    const out = { id: `${write.id}-${fault}`, task: write.task, fault, setup, path, status: read.status, derivable, verdict, fields, observed: read.result, ms };
    writeFileSync(new URL(`${out.id}.json`, directory), `${JSON.stringify(out, null, 2)}\n`);
    console.log(out.id, read.status, verdict, fields.map((field) => field.held));
  }
}
