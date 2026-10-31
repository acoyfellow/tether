export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/v2") return new Response("hello from gl-rb-wrong-path v2");
    return new Response("hello from gl-rb-wrong-path v1");
  },
};
