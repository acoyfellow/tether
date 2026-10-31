type Env = { GREETINGS: { get(key: string): Promise<string | null> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const greeting = (await env.GREETINGS.get("hello")) ?? "hi";
    const { pathname } = new URL(request.url);
    if (pathname === "/") return Response.json({ greeting });
    return new Response("not found", { status: 404 });
  },
};
