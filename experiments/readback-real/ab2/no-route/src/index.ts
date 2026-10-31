type Env = Record<string, never>;

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/") return Response.json({ greeting: "hi" });
    return new Response("not found", { status: 404 });
  },
};
