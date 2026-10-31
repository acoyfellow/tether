import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEPLOY = /\b(wrangler\s+(deploy|versions\s+deploy)|alchemy\s+deploy)\b/;
const URL_IN_OUTPUT = /https:\/\/[a-z0-9.-]+\.(workers\.dev|[a-z0-9-]+\.[a-z]{2,})(\/[^\s"'`)]*)?/gi;
const VERSION = /Current Version ID:\s*([0-9a-f-]{8,})/i;
const NOT_A_SITE = /(api\.cloudflare\.com|dash\.cloudflare\.com|developers\.cloudflare\.com|github\.com|npmjs\.com)/i;
const TIMEOUT_MS = 8000;

export type Probe = { url: string; status: number | null; error: string | null; ms: number };

export function isDeploy(command: string): boolean {
  return DEPLOY.test(command);
}

export function deployedUrls(output: string): string[] {
  const found = output.match(URL_IN_OUTPUT) ?? [];
  return [...new Set(found.map((url) => url.replace(/[.,;:]+$/, "")))].filter((url) => !NOT_A_SITE.test(url)).slice(0, 3);
}

export function versionId(output: string): string | null {
  return output.match(VERSION)?.[1] ?? null;
}

export function readbackLine(probes: Probe[], version: string | null): string {
  if (probes.length === 0) return "readback: the deploy printed no URL, so nothing was read back. Check the live site before you say it works.";
  const parts = probes.map((probe) => (probe.status === null ? `${probe.url} → no answer (${probe.error})` : `${probe.url} → ${probe.status} in ${probe.ms} ms`));
  const bad = probes.some((probe) => probe.status === null || probe.status >= 400);
  const head = bad ? "readback: the deploy said ok, but the live URL does not." : "readback: the live URL answers.";
  const tail = bad
    ? "Do not say it works until the live URL does. Check the account, the route and the logs."
    : `That proves it is up, not that it runs your change${version ? ` (version ${version})` : ""}. Check the behaviour you changed.`;
  return [head, ...parts.map((part) => `  ${part}`), tail].join("\n");
}

async function probe(url: string): Promise<Probe> {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { url, status: response.status, error: null, ms: Date.now() - started };
  } catch (error) {
    return { url, status: null, error: error instanceof Error ? error.name : "error", ms: Date.now() - started };
  }
}

export default function readback(pi: ExtensionAPI) {
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash" || event.isError) return undefined;
    if (!isDeploy(String(event.input.command ?? ""))) return undefined;
    const output = event.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
    const probes = await Promise.all(deployedUrls(output).map(probe));
    return { content: [...event.content, { type: "text", text: `\n${readbackLine(probes, versionId(output))}` }] };
  });
}
