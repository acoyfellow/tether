export default {
  async fetch(): Promise<Response> {
    const config = JSON.parse("{ greeting: 'hello' }");
    return new Response(`${config.greeting} from gl-rb-throws`);
  },
};
