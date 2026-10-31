import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";

const env = { GREETINGS: { get: async () => "hello" } } as never;
const request = (path: string) => new Request(`https://example.com${path}`, { headers: { origin: "https://app.example.com" } });

test("home returns a greeting", async () => {
  const response = await worker.fetch(request("/"), env);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).greeting);
});
