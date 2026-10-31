import { test } from "node:test";
import assert from "node:assert/strict";
import { deployedUrls, isDeploy, readbackLine, versionId } from "./readback.ts";

const WRANGLER = `Uploaded hotpot (1.66 sec)
Deployed hotpot triggers (1.24 sec)
  https://hotpot.example-account.workers.dev
Current Version ID: 5edf4309-bb1e-486e-b979-ea7227f439f0`;

test("deploy commands are recognised and other commands are not", () => {
  assert.equal(isDeploy("cd app && npx wrangler deploy 2>&1 | tail -5"), true);
  assert.equal(isDeploy("bunx alchemy deploy --profile personal"), true);
  assert.equal(isDeploy("wrangler versions deploy"), true);
  assert.equal(isDeploy("wrangler deploy --dry-run"), true);
  assert.equal(isDeploy("wrangler tail"), false);
  assert.equal(isDeploy("cat deploy.md"), false);
});

test("the printed URL and version are read from wrangler output", () => {
  assert.deepEqual(deployedUrls(WRANGLER), ["https://hotpot.example-account.workers.dev"]);
  assert.equal(versionId(WRANGLER), "5edf4309-bb1e-486e-b979-ea7227f439f0");
});

test("API and docs links are not treated as the deployed site", () => {
  const output = "see https://developers.cloudflare.com/workers/ and https://api.cloudflare.com/client/v4\nhttps://app.example.com/.";
  assert.deepEqual(deployedUrls(output), ["https://app.example.com/"]);
});

test("a 404 on the live URL says the deploy did not land", () => {
  const line = readbackLine([{ url: "https://a.workers.dev", status: 404, error: null, ms: 80 }], "abc12345");
  assert.match(line, /the live URL does not/);
  assert.match(line, /404/);
  assert.match(line, /Do not say it works/);
});

test("no answer is treated as a failure", () => {
  assert.match(readbackLine([{ url: "https://a.workers.dev", status: null, error: "TimeoutError", ms: 8000 }], null), /does not.*\n.*no answer \(TimeoutError\)/s);
});

test("a 200 still asks for a behaviour check and names the version", () => {
  const line = readbackLine([{ url: "https://a.workers.dev", status: 200, error: null, ms: 40 }], "abc12345");
  assert.match(line, /answers/);
  assert.match(line, /not that it runs your change \(version abc12345\)/);
});

test("no printed URL asks for a manual live check", () => {
  assert.match(readbackLine([], null), /printed no URL/);
});
