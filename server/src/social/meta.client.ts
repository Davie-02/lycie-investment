/**
 * A thin, dependency-free client for Meta's Graph API — the way to publish to a Facebook Page and
 * an Instagram business account, read the comments people leave, and reply to comments and messages.
 *
 * It is configured entirely from environment variables (see DEPLOYMENT.md → "Social media"):
 *   META_PAGE_ID, META_PAGE_ACCESS_TOKEN  — the Facebook Page and its access token
 *   META_INSTAGRAM_ID                     — the Instagram business account linked to that Page
 *   META_GRAPH_VERSION                    — optional, default v21.0
 * With none set the social tools simply show "not connected".
 *
 * Every call takes the network function as a parameter-free field so tests can replace it.
 */

export type Channel = "facebook" | "instagram";

export interface SocialStatus {
  facebook: boolean;
  instagram: boolean;
}

/** One thing a person said to the company: a comment on a post, or a private message. */
export interface InboxItem {
  id: string;
  channel: Channel;
  kind: "comment" | "message";
  /** What the person wrote. */
  text: string;
  author: string;
  /** For messages: who to reply to. */
  authorId?: string;
  createdAt: string;
  /** The post the comment is on (its first words), for context. */
  onPost?: string;
  link?: string;
}

/** A friendly error for the admin — never raw Graph API JSON. */
export class SocialError extends Error {
  constructor(
    message: string,
    /** True when the connection itself needs fixing (expired token, missing permission). */
    readonly needsReconnect = false
  ) {
    super(message);
  }
}

type FetchFn = typeof fetch;

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

export class MetaClient {
  /** Replaceable in tests. */
  fetchFn: FetchFn = (...args) => fetch(...args);

  private get version() {
    return process.env.META_GRAPH_VERSION || "v21.0";
  }
  private get pageId() {
    return process.env.META_PAGE_ID;
  }
  private get token() {
    return process.env.META_PAGE_ACCESS_TOKEN;
  }
  private get instagramId() {
    return process.env.META_INSTAGRAM_ID;
  }

  status(): SocialStatus {
    return { facebook: Boolean(this.pageId && this.token), instagram: Boolean(this.instagramId && this.token) };
  }

  /** Calls the Graph API and turns failures into plain-language SocialErrors. */
  private async call<T>(method: "GET" | "POST", path: string, params: Record<string, string | number | undefined> = {}, body?: Record<string, unknown>): Promise<T> {
    if (!this.token) throw new SocialError("Social media isn't connected yet.");
    const url = new URL(`https://graph.facebook.com/${this.version}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));

    let response: Response;
    try {
      // The token travels in a header, never in the address, so it can't end up in logs.
      response = await this.fetchFn(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${this.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new SocialError("Couldn't reach Facebook. Check the connection and try again.");
    }

    const data = (await response.json().catch(() => ({}))) as T & GraphError;
    if (!response.ok || data.error) {
      const code = data.error?.code;
      if (code === 190) throw new SocialError("The Facebook connection has expired. Create a new access token and update META_PAGE_ACCESS_TOKEN.", true);
      if (code === 10 || code === 200 || code === 299) throw new SocialError("Facebook says this connection doesn't have permission for that action. Check the app's permissions.", true);
      if (code === 4 || code === 17 || code === 32 || code === 613) throw new SocialError("Facebook is limiting how often we can do that. Try again in a little while.");
      throw new SocialError(data.error?.message ? `Facebook said: ${data.error.message}` : "Facebook couldn't complete that request.");
    }
    return data;
  }

  // ------------------------------------------------------------------ publishing

  /** Posts to the Facebook Page: a photo post when there's an image, otherwise a text/link post. */
  async postToFacebook(input: { message: string; imageUrl?: string | null; linkUrl?: string | null }): Promise<string> {
    if (!this.pageId) throw new SocialError("No Facebook Page is connected.");
    const text = input.linkUrl && !input.imageUrl ? input.message : [input.message, input.linkUrl].filter(Boolean).join("\n\n");
    if (input.imageUrl) {
      const result = await this.call<{ post_id?: string; id: string }>("POST", `${this.pageId}/photos`, {}, { url: input.imageUrl, caption: text });
      return result.post_id ?? result.id;
    }
    const result = await this.call<{ id: string }>("POST", `${this.pageId}/feed`, {}, { message: input.message, ...(input.linkUrl ? { link: input.linkUrl } : {}) });
    return result.id;
  }

  /** Posts to Instagram (a picture is required by Instagram): create the media, then publish it. */
  async postToInstagram(input: { message: string; imageUrl?: string | null; linkUrl?: string | null }): Promise<string> {
    if (!this.instagramId) throw new SocialError("No Instagram account is connected.");
    if (!input.imageUrl) throw new SocialError("Instagram posts need a picture. Add one, or uncheck Instagram.");
    const caption = [input.message, input.linkUrl].filter(Boolean).join("\n\n");
    const created = await this.call<{ id: string }>("POST", `${this.instagramId}/media`, {}, { image_url: input.imageUrl, caption });
    const published = await this.call<{ id: string }>("POST", `${this.instagramId}/media_publish`, {}, { creation_id: created.id });
    return published.id;
  }

  // ------------------------------------------------------------------ inbox

  async facebookComments(limit = 10): Promise<InboxItem[]> {
    if (!this.status().facebook) return [];
    const data = await this.call<{ data?: Array<{ message?: string; permalink_url?: string; comments?: { data?: Array<{ id: string; message?: string; from?: { name?: string; id?: string }; created_time: string }> } }> }>("GET", `${this.pageId}/posts`, {
      fields: `message,permalink_url,comments.limit(${limit}){id,message,from,created_time}`,
      limit,
    });
    return (data.data ?? []).flatMap((post) =>
      (post.comments?.data ?? []).map((comment) => ({
        id: comment.id,
        channel: "facebook" as const,
        kind: "comment" as const,
        text: comment.message ?? "",
        author: comment.from?.name ?? "Someone",
        createdAt: comment.created_time,
        onPost: (post.message ?? "").slice(0, 80),
        link: post.permalink_url,
      }))
    );
  }

  async instagramComments(limit = 10): Promise<InboxItem[]> {
    if (!this.status().instagram) return [];
    const data = await this.call<{ data?: Array<{ caption?: string; permalink?: string; comments?: { data?: Array<{ id: string; text?: string; username?: string; timestamp: string }> } }> }>("GET", `${this.instagramId}/media`, {
      fields: `caption,permalink,comments.limit(${limit}){id,text,username,timestamp}`,
      limit,
    });
    return (data.data ?? []).flatMap((media) =>
      (media.comments?.data ?? []).map((comment) => ({
        id: comment.id,
        channel: "instagram" as const,
        kind: "comment" as const,
        text: comment.text ?? "",
        author: comment.username ?? "Someone",
        createdAt: comment.timestamp,
        onPost: (media.caption ?? "").slice(0, 80),
        link: media.permalink,
      }))
    );
  }

  /** Recent private messages (Messenger). Returns the latest message from each conversation, if it came from a customer. */
  async facebookMessages(limit = 15): Promise<InboxItem[]> {
    if (!this.status().facebook) return [];
    const data = await this.call<{ data?: Array<{ id: string; messages?: { data?: Array<{ id: string; message?: string; from?: { name?: string; id?: string }; created_time: string }> } }> }>("GET", `${this.pageId}/conversations`, {
      fields: "id,messages.limit(1){id,message,from,created_time}",
      limit,
    });
    const items: InboxItem[] = [];
    for (const conversation of data.data ?? []) {
      const message = conversation.messages?.data?.[0];
      // Skip conversations where the company spoke last — nothing waiting for a reply.
      if (!message || message.from?.id === this.pageId) continue;
      items.push({
        id: message.id,
        channel: "facebook",
        kind: "message",
        text: message.message ?? "",
        author: message.from?.name ?? "Someone",
        authorId: message.from?.id,
        createdAt: message.created_time,
      });
    }
    return items;
  }

  // ------------------------------------------------------------------ replying

  async replyToComment(channel: Channel, commentId: string, message: string): Promise<void> {
    if (channel === "instagram") await this.call("POST", `${commentId}/replies`, {}, { message });
    else await this.call("POST", `${commentId}/comments`, {}, { message });
  }

  /** Replies to a Messenger conversation. Facebook only allows this within 24 hours of the customer's message. */
  async replyToMessage(recipientId: string, text: string): Promise<void> {
    if (!this.pageId) throw new SocialError("No Facebook Page is connected.");
    await this.call("POST", `${this.pageId}/messages`, {}, { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } });
  }
}
