import { MetaClient, SocialError } from "./meta.client";

function clientWith(responses: Array<{ status?: number; body: unknown }>) {
  const client = new MetaClient();
  const calls: Array<{ url: string; init: RequestInit }> = [];
  client.fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra call");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as unknown as typeof fetch;
  return { client, calls };
}

beforeEach(() => {
  process.env.META_PAGE_ID = "PAGE1";
  process.env.META_PAGE_ACCESS_TOKEN = "secret-token";
  process.env.META_INSTAGRAM_ID = "IG1";
});
afterEach(() => {
  delete process.env.META_PAGE_ID;
  delete process.env.META_PAGE_ACCESS_TOKEN;
  delete process.env.META_INSTAGRAM_ID;
});

describe("MetaClient", () => {
  it("reports which channels are connected", () => {
    expect(new MetaClient().status()).toEqual({ facebook: true, instagram: true });
    delete process.env.META_INSTAGRAM_ID;
    expect(new MetaClient().status()).toEqual({ facebook: true, instagram: false });
    delete process.env.META_PAGE_ACCESS_TOKEN;
    expect(new MetaClient().status()).toEqual({ facebook: false, instagram: false });
  });

  it("posts text to the Page feed, sending the token in a header and never in the address", async () => {
    const { client, calls } = clientWith([{ body: { id: "PAGE1_99" } }]);
    expect(await client.postToFacebook({ message: "Hello", linkUrl: "https://site/x" })).toBe("PAGE1_99");
    expect(calls[0].url).toContain("/PAGE1/feed");
    expect(calls[0].url).not.toContain("secret-token");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ message: "Hello", link: "https://site/x" });
  });

  it("posts a photo with the words as its caption", async () => {
    const { client, calls } = clientWith([{ body: { id: "photo1", post_id: "PAGE1_5" } }]);
    expect(await client.postToFacebook({ message: "New arrival", imageUrl: "https://site/a.jpg" })).toBe("PAGE1_5");
    expect(calls[0].url).toContain("/PAGE1/photos");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ url: "https://site/a.jpg", caption: "New arrival" });
  });

  it("publishes to Instagram in two steps, and refuses a post without a picture", async () => {
    const { client, calls } = clientWith([{ body: { id: "creation1" } }, { body: { id: "media1" } }]);
    expect(await client.postToInstagram({ message: "Hi", imageUrl: "https://site/a.jpg" })).toBe("media1");
    expect(calls[0].url).toContain("/IG1/media");
    expect(calls[1].url).toContain("/IG1/media_publish");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ creation_id: "creation1" });
    await expect(client.postToInstagram({ message: "no picture" })).rejects.toThrow(/need a picture/);
  });

  it("turns a Graph API failure into a plain-language error, flagging expired tokens", async () => {
    const { client } = clientWith([{ status: 400, body: { error: { code: 190, message: "Error validating access token" } } }]);
    const error = await client.postToFacebook({ message: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(SocialError);
    expect(error.needsReconnect).toBe(true);
    expect(error.message).toMatch(/expired/);
  });

  it("reads comments on Page posts into inbox items", async () => {
    const { client } = clientWith([{ body: { data: [{ message: "Our new Hilux arrived today", permalink_url: "https://fb/p1", comments: { data: [{ id: "c1", message: "How much?", from: { name: "Ann" }, created_time: "2026-09-21T10:00:00+0000" }] } }] } }]);
    expect(await client.facebookComments()).toEqual([
      { id: "c1", channel: "facebook", kind: "comment", text: "How much?", author: "Ann", createdAt: "2026-09-21T10:00:00+0000", onPost: "Our new Hilux arrived today", link: "https://fb/p1" },
    ]);
  });

  it("only lists conversations where the customer spoke last", async () => {
    const { client } = clientWith([
      { body: { data: [
        { id: "t1", messages: { data: [{ id: "m1", message: "Is the Fit available?", from: { name: "Ben", id: "U1" }, created_time: "2026-09-21T09:00:00+0000" }] } },
        { id: "t2", messages: { data: [{ id: "m2", message: "Thanks, sent!", from: { name: "Us", id: "PAGE1" }, created_time: "2026-09-21T09:05:00+0000" }] } },
      ] } },
    ]);
    const items = await client.facebookMessages();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "m1", authorId: "U1", kind: "message" });
  });

  it("replies to comments on each network and to Messenger conversations", async () => {
    const { client, calls } = clientWith([{ body: { id: "r1" } }, { body: { id: "r2" } }, { body: { message_id: "m" } }]);
    await client.replyToComment("facebook", "c1", "Thanks!");
    await client.replyToComment("instagram", "c2", "Thanks!");
    await client.replyToMessage("U1", "Yes it is");
    expect(calls[0].url).toContain("/c1/comments");
    expect(calls[1].url).toContain("/c2/replies");
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ recipient: { id: "U1" }, messaging_type: "RESPONSE", message: { text: "Yes it is" } });
  });

  it("does nothing, and says so, when not connected", async () => {
    delete process.env.META_PAGE_ACCESS_TOKEN;
    await expect(new MetaClient().postToFacebook({ message: "x" })).rejects.toThrow(/isn't connected/);
    expect(await new MetaClient().facebookComments()).toEqual([]);
  });
});
