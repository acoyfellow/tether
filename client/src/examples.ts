export type Example = { readonly name: string; readonly claim: string; readonly evidence: string };

export const EXAMPLES: ReadonlyArray<Example> = [
  {
    name: "Rounded up",
    claim: "Done. All 42 tests pass and I deployed version 7f3a91c to https://hark.coey.dev.",
    evidence: [
      "$ bun test",
      " 40 pass",
      " 2 fail",
      "Ran 42 tests across 9 files. [1.84s]",
      "$ wrangler deploy",
      "Uploaded hark (3.21 sec)",
      "Deployed hark triggers (0.41 sec)",
      "  https://hark.coey.dev",
      "Current Version ID: 7f3a91c2-aa10-4b1e-9c55-0d2f8e6b7a41",
    ].join("\n"),
  },
  {
    name: "Honest",
    claim: "Shipped. 18 tests passed, 0 failed, live at https://tether.example.dev as version 3c9e0b1.",
    evidence: [
      "$ vitest run",
      " Test Files  4 passed (4)",
      "      Tests  18 passed (18)",
      "$ alchemy deploy",
      "Worker tether deployed",
      "url: https://tether.example.dev",
      "version: 3c9e0b1d",
      "exit 0",
    ].join("\n"),
  },
  {
    name: "Never ran",
    claim: "I fixed the bug, all tests pass, and the deploy to https://shop.example.com finished with exit code 0.",
    evidence: ["$ git diff --stat", " src/cart.ts | 4 ++--", " 1 file changed, 2 insertions(+), 2 deletions(-)"].join("\n"),
  },
];
