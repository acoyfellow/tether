# tether public release loop

Proof: `bash proof/gate.sh`

| Step | State |
|---|---|
| 1. Mine claim/evidence pairs from Pi sessions | done: 1803 pairs, 176 sessions, `.real/mined.json` (gitignored) |
| 1b. Label rule + broken-case method frozen | done: eval/RULE.md, 120 cases, 77 sessions, holdout 61 |
| 2. Run tether, Clef alone, regex on holdout, 3 runs | done 4601a6b: disproven. tether r=1.0 p=0.776 ff=0.48; clef r=0.5 p=1.0; regex r=1.0 p=0.95 |
| 3. README, docs, design to echo bar | done: README, 5 docs pages, landing + proof table, verified locally (ffab3e6, 4e032af) |
| 4. Deploy tether.customer0.dev (account 29db7c74093386544fed8046ef083a4b) | deployed (stage customer0, worker tether-tether-customer0-ll2ee7gle2yjoolf, custom domain bound). Edge answers 403 / error 1050; account had no workers.dev subdomain (created customer0-jcoeyman). Probe worker tether-probe deployed to check the account; delete it once tether answers |
| 5. Desktop and mobile screenshots | after deploy |
| 6. Public repo acoyfellow/tether, clean clone passes | blocked: the contract says GitHub main == HEAD, but merge: gate blocks pushes to main/release until the gate passes. Needs the user to push, or re-lock with merge: never and a gate that checks a feature branch |
| 7. MY_REPO_SHAPE_V3.md tether section | done: variant section added |

## Blocker (2026-10-28)

- `wrangler whoami`: not authenticated.
- `clairic-clef/.real/t` token: verify returns false (revoked or expired).
- Needed: `wrangler login` with the Customer 0 account, which needs Workers AI and Workers scripts plus DNS for customer0.dev.
