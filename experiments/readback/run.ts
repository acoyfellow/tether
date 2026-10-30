import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { apiOk, judge } from "../../src/readback/check.ts";
import { type Api, read, reset, write } from "../../src/readback/cloudflare.ts";
import type { Case } from "./gen.ts";

const run = process.argv[2];
const token = process.env["CF_TOKEN"];
const account = process.env["CF_ACCOUNT"];
if (!run || !token || !account) throw new Error("usage: CF_TOKEN=.. CF_ACCOUNT=.. bun run.ts <run>");

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as Case[];
const directory = new URL(`./runs/${run}/`, import.meta.url);
mkdirSync(directory, { recursive: true });

for (const item of cases) {
  const setup: Api = { token, account, calls: 0 };
  await reset(setup, item.record.target);
  for (const step of item.steps) await write(setup, item.record.target, step);

  const api: Api = { token, account, calls: 0 };
  const started = performance.now();
  const observed = await read(api, item.record.target);
  const readback = judge(item.record, observed);
  const ms = performance.now() - started;

  const out = { id: item.id, kind: item.kind, fault: item.fault, api_ok: apiOk(item.record).verdict, readback, ms, calls: api.calls };
  writeFileSync(new URL(`${item.id}.json`, directory), `${JSON.stringify(out, null, 2)}\n`);
  console.log(item.id, item.fault, readback.verdict, Math.round(ms));
}
