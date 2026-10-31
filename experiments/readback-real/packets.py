import glob
import hashlib
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from mine import FAILED, SESSIONS, WRITE, CLAIM, events

SEED = 20261031
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 70
OUT = os.path.join(os.path.dirname(__file__), "packets.jsonl")


def claimed_writes():
    for path in sorted(glob.glob(f"{SESSIONS}/*/*.jsonl")):
        stream = list(events(path))
        for index, (kind, command, output) in enumerate(stream):
            if kind != "run" or not WRITE.search(command) or FAILED.search(output or ""):
                continue
            later = stream[index + 1:index + 26]
            if not any(k == "say" and CLAIM.search(text) for k, text, _ in later):
                continue
            yield path, index, command, output, later


def trim(text, limit):
    text = text or ""
    return text if len(text) <= limit else text[: limit // 2] + "\n…\n" + text[-limit // 2:]


def main():
    rows = list(claimed_writes())
    random.Random(SEED).shuffle(rows)
    with open(OUT, "w") as out:
        for path, index, command, output, later in rows[:COUNT]:
            key = hashlib.sha256(f"{os.path.basename(path)}:{index}:{command}".encode()).hexdigest()[:16]
            after = [
                {"kind": k, "text": trim(text, 700), "output": trim(o, 900) if o is not None else None}
                for k, text, o in later
            ]
            out.write(json.dumps({"id": key, "write": trim(command, 600), "write_output": trim(output, 900), "after": after}) + "\n")
    print(f"{len(rows)} claimed writes, wrote {min(COUNT, len(rows))} packets")


main()
