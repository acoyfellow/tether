export default {
  async fetch(): Promise<Response> {
    return new Response("hello from gl-rb-no-route v2");
  },
};
