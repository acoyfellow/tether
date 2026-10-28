import { ALCHEMY_DEV, Stack, localState } from "alchemy";
import { RateLimit, Worker, Workers, providers } from "alchemy/Cloudflare";
import { Config, Effect } from "effect";

const COMPATIBILITY_DATE = "2026-10-01";

export default Stack(
  "tether",
  { providers: providers(), state: localState() },
  Effect.gen(function* () {
    const developing = yield* ALCHEMY_DEV;
    const extractModel = yield* Config.String("S1_EXTRACT_MODEL");
    const decideModel = yield* Config.String("S1_DECIDE_MODEL");
    const hostname = yield* Config.String("TETHER_HOSTNAME").pipe(Config.withDefault("tether.customer0.dev"));

    const settings = {
      main: "./src/index.ts",
      compatibility: { date: COMPATIBILITY_DATE, flags: ["nodejs_compat"] },
      observability: { enabled: true },
      assets: { directory: "./public", runWorkerFirst: ["/api/*", "/docs/*", "/docs"] },
      env: {
        AI: Workers.AI(),
        CHECK_LIMIT: RateLimit("CHECK_LIMIT", { namespaceId: 4141, simple: { limit: 10, period: 60 } }),
        S1_EXTRACT_MODEL: extractModel,
        S1_DECIDE_MODEL: decideModel,
      },
    };

    const worker = developing
      ? yield* Worker("tether", { ...settings, workersDev: true })
      : yield* Worker("tether", { ...settings, workersDev: false, domain: { name: hostname } });

    return { url: worker.url, worker: worker.workerName };
  }),
);
