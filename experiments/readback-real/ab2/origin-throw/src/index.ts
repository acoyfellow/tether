type Env = Record<string, never>;

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const caller = new URL(request.headers.get("origin") as string).host;
    const { pathname } = new URL(request.url);
    if (pathname === "/") return Response.json({ greeting: "hi", caller });
    return new Response("not found", { status: 404 });
  },
};
