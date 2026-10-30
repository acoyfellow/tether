import type { Target } from "./check.ts";

export type Api = { token: string; account: string; calls: number };

const ROOT = "https://api.cloudflare.com/client/v4/accounts";

async function call(api: Api, method: string, path: string, body?: unknown): Promise<unknown> {
  api.calls += 1;
  const isText = typeof body === "string";
  const response = await fetch(`${ROOT}/${api.account}/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${api.token}`,
      "content-type": isText ? "text/plain" : "application/json",
    },
    body: body === undefined ? undefined : isText ? body : JSON.stringify(body),
  });
  if (path.includes("/values/") && method === "GET") {
    return response.status === 404 ? null : response.text();
  }
  const parsed = (await response.json()) as { success: boolean; result: unknown; errors: unknown };
  if (!parsed.success) throw new Error(`${method} ${path}: ${JSON.stringify(parsed.errors)}`);
  return parsed.result;
}

function d1(api: Api, database: string, sql: string, params: string[]): Promise<unknown> {
  return call(api, "POST", `d1/database/${database}/query`, { sql, params });
}

export async function write(api: Api, target: Target, values: Record<string, unknown>): Promise<void> {
  if (target.kind === "kv") {
    await call(api, "PUT", `storage/kv/namespaces/${target.namespace}/values/${target.key}`, String(values["value"]));
    return;
  }
  if (target.kind === "d1") {
    const columns = Object.keys(values);
    await d1(
      api,
      target.database,
      `INSERT INTO ${target.table} (id, ${columns.join(", ")}) VALUES (?, ${columns.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${columns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
      [target.id, ...columns.map((column) => String(values[column]))],
    );
    return;
  }
  const tags = Object.keys(values)
    .sort()
    .map((key) => values[key]);
  await call(api, "PUT", `workers/scripts/${target.script}/tags`, tags);
}

export async function read(api: Api, target: Target): Promise<Record<string, unknown>> {
  if (target.kind === "kv") {
    return { value: await call(api, "GET", `storage/kv/namespaces/${target.namespace}/values/${target.key}`) };
  }
  if (target.kind === "d1") {
    const result = (await d1(api, target.database, `SELECT a, b FROM ${target.table} WHERE id = ?`, [target.id])) as {
      results: Record<string, unknown>[];
    }[];
    return result[0]?.results[0] ?? {};
  }
  const tags = ((await call(api, "GET", `workers/scripts/${target.script}/tags`)) as string[] | null) ?? [];
  return Object.fromEntries(tags.map((tag, index) => [`tag${index}`, tag]));
}

export async function reset(api: Api, target: Target): Promise<void> {
  if (target.kind === "kv") {
    await call(api, "DELETE", `storage/kv/namespaces/${target.namespace}/values/${target.key}`);
    return;
  }
  if (target.kind === "d1") {
    await d1(api, target.database, `DELETE FROM ${target.table} WHERE id = ?`, [target.id]);
    return;
  }
  await call(api, "PUT", `workers/scripts/${target.script}/tags`, []);
}
