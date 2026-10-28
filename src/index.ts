import { Effect } from "effect";
import { Schema } from "effect";
import { type AiRunner, s1Layer } from "./s1/index.ts";
import { check } from "./check.ts";

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

type Env = {
  readonly AI: AiRunner;
  readonly CHECK_LIMIT: Limiter;
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
  readonly S1_EXTRACT_MODEL: string;
  readonly S1_DECIDE_MODEL: string;
};

const MAX_CHARS = 12_000;

const DOC_PAGE = /^\/docs\/([a-z0-9-]+)\/?$/;

const CheckBody = Schema.Struct({
  claim: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_CHARS)),
  evidence: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_CHARS)),
});

const decodeBody = Schema.decodeUnknownEffect(Schema.fromJsonString(CheckBody));

const runCheck = async (request: Request, env: Env) => {
  const body = await request.text();

  const program = decodeBody(body).pipe(
    Effect.mapError(() => ({ status: 400, error: `claim and evidence must be 1 to ${MAX_CHARS} characters` })),
    Effect.flatMap((input) =>
      check(input).pipe(Effect.mapError((failure) => ({ status: 502, error: `${failure._tag}: ${failure.message}` }))),
    ),
    Effect.provide(s1Layer(env.AI, { extract: env.S1_EXTRACT_MODEL, decide: env.S1_DECIDE_MODEL })),
    Effect.match({
      onFailure: ({ status, error }) => Response.json({ error }, { status }),
      onSuccess: (result) => Response.json(result),
    }),
  );

  return Effect.runPromise(program);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/check" && request.method === "POST") {
      const caller = request.headers.get("cf-connecting-ip") ?? "local";
      const { success } = await env.CHECK_LIMIT.limit({ key: caller });

      if (!success) return Response.json({ error: "rate limited: 10 checks per minute" }, { status: 429 });

      return runCheck(request, env);
    }

    if (url.pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });

    const doc = url.pathname.match(DOC_PAGE);

    if (doc) return env.ASSETS.fetch(new Request(new URL(`/docs/${doc[1]}`, url), request));

    if (url.pathname === "/docs" || url.pathname === "/docs/") return Response.redirect(new URL("/docs/how-it-works", url), 302);

    return env.ASSETS.fetch(request);
  },
};
