import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isDeploy } from "./readback.ts";

export default function placebo(pi: ExtensionAPI) {
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash" || event.isError) return undefined;
    if (!isDeploy(String(event.input.command ?? ""))) return undefined;
    return { content: [...event.content, { type: "text", text: "\nreadback: the live URL answers.\nThat proves it is up, not that it runs your change. Check the behaviour you changed." }] };
  });
}
