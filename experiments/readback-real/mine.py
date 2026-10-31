import glob
import json
import os
import re
import sys

SESSIONS = os.path.expanduser("~/.pi/agent/sessions")
OUT = sys.argv[1]

WRITE = re.compile(
    r"(curl[^\n]*-X\s*(PUT|POST|PATCH|DELETE)[^\n]*api\.cloudflare\.com"
    r"|wrangler\s+(deploy|kv\s+key\s+put|d1\s+execute|secret\s+put|r2\s+object\s+put|versions\s+deploy|triggers\s+deploy)"
    r"|alchemy\s+deploy)",
    re.I,
)
READ = re.compile(
    r"(curl(?![^\n]*-X\s*(PUT|POST|PATCH|DELETE))[^\n]*api\.cloudflare\.com"
    r"|wrangler\s+(kv\s+key\s+get|kv:key\s+get|d1\s+execute[^\n]*SELECT|deployments\s+list|versions\s+list|tail|r2\s+object\s+get)"
    r"|curl[^\n]*https://[^\s\"']+\.(workers\.dev|customer0\.dev|coey\.dev))",
    re.I,
)
FAILED = re.compile(r'"success"\s*:\s*false|\bERROR\b|✘|error code|Authentication error|\b(4\d\d|5\d\d)\b (Not Found|Forbidden|Unauthorized|Bad Request|Internal)', re.I)
CLAIM = re.compile(r"\b(deployed|updated|set|written|created|saved|applied|live|is now)\b", re.I)


def text_of(content):
    if isinstance(content, str):
        return content
    return " ".join(part.get("text", "") for part in content or [] if isinstance(part, dict))


def command_of(arguments):
    if isinstance(arguments, str):
        try:
            arguments = json.loads(arguments)
        except json.JSONDecodeError:
            return ""
    return arguments.get("command", "") if isinstance(arguments, dict) else ""


def events(path):
    calls = {}
    for line in open(path, errors="ignore"):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        message = entry.get("message") or {}
        role = message.get("role")
        content = message.get("content")
        if role == "assistant":
            for part in content or []:
                if isinstance(part, dict) and part.get("type") == "toolCall" and part.get("name") == "bash":
                    calls[part.get("id")] = command_of(part.get("arguments"))
            said = text_of(content).strip()
            if said:
                yield ("say", said, None)
        elif role == "toolResult":
            command = calls.get(message.get("toolCallId"), "")
            if command:
                yield ("run", command, text_of(content))


def mine():
    rows = []
    for path in glob.glob(f"{SESSIONS}/*/*.jsonl"):
        stream = list(events(path))
        for index, (kind, command, output) in enumerate(stream):
            if kind != "run" or not WRITE.search(command):
                continue
            write_failed = bool(FAILED.search(output or ""))
            later = stream[index + 1:index + 25]
            claim = next((text for k, text, _ in later if k == "say" and CLAIM.search(text)), None)
            reads = [(c, o) for k, c, o in later if k == "run" and READ.search(c)]
            redo = [c for k, c, _ in later if k == "run" and WRITE.search(c)]
            read_failed = any(FAILED.search(o or "") for _, o in reads)
            rows.append({
                "session": os.path.basename(path)[:40],
                "index": index,
                "write": command[:300],
                "write_failed": write_failed,
                "claimed": bool(claim),
                "claim": (claim or "")[:300],
                "reads_after": len(reads),
                "read_failed": read_failed,
                "rewrites_after": len(redo),
                "read_samples": [(c[:200], (o or "")[-300:]) for c, o in reads[:2]],
            })
    with open(OUT, "w") as out:
        for row in rows:
            out.write(json.dumps(row) + "\n")
    print(f"{len(rows)} writes")


if __name__ == "__main__":
    mine()
