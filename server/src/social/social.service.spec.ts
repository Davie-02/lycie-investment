import { BadRequestException } from "@nestjs/common";
import type { SocialPost } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { MetaClient, SocialError } from "./meta.client";
import { SocialService } from "./social.service";

function build(meta: Partial<Record<keyof MetaClient, jest.Mock>> = {}) {
  const rows: SocialPost[] = [];
  const prisma = {
    socialPost: {
      create: jest.fn(async ({ data }: { data: Partial<SocialPost> }) => {
        const row = { id: `p${rows.length + 1}`, results: null, publishedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data } as SocialPost;
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<SocialPost> }) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
      findMany: jest.fn(async () => rows.filter((r) => r.status === "SCHEDULED")),
      delete: jest.fn(),
    },
  };
  const client = { status: jest.fn(() => ({ facebook: true, instagram: true })), postToFacebook: jest.fn(async () => "FB1"), postToInstagram: jest.fn(async () => "IG1"), ...meta };
  return { service: new SocialService(prisma as unknown as PrismaService, client as unknown as MetaClient), rows, client };
}

const dto = { message: "New Hilux arrived", channels: ["facebook", "instagram"], imageUrl: "/uploads/a.webp" };

describe("SocialService.create", () => {
  it("'now' publishes to every selected page and marks the post PUBLISHED", async () => {
    const { service, client } = build();
    const post = await service.create({ ...dto, mode: "now" });
    expect(post.status).toBe("PUBLISHED");
    expect(client.postToFacebook).toHaveBeenCalledWith(expect.objectContaining({ message: "New Hilux arrived", imageUrl: expect.stringContaining("/uploads/a.webp") }));
    expect(post.results).toEqual({ facebook: { ok: true, id: "FB1" }, instagram: { ok: true, id: "IG1" } });
  });

  it("'draft' only saves, sending nothing", async () => {
    const { service, client } = build();
    const post = await service.create({ ...dto, mode: "draft" });
    expect(post.status).toBe("DRAFT");
    expect(client.postToFacebook).not.toHaveBeenCalled();
  });

  it("'schedule' needs a time in the future", async () => {
    const { service } = build();
    await expect(service.create({ ...dto, mode: "schedule", scheduledFor: new Date(Date.now() - 1000).toISOString() })).rejects.toBeInstanceOf(BadRequestException);
    const ok = await service.create({ ...dto, mode: "schedule", scheduledFor: new Date(Date.now() + 3600_000).toISOString() });
    expect(ok.status).toBe("SCHEDULED");
  });
});

describe("partial failures and retries", () => {
  it("records what went wrong per page and marks the post PARTIAL", async () => {
    const { service } = build({ postToInstagram: jest.fn(async () => { throw new SocialError("Instagram posts need a picture."); }) });
    const post = await service.create({ ...dto, mode: "now" });
    expect(post.status).toBe("PARTIAL");
    expect(post.results).toMatchObject({ facebook: { ok: true }, instagram: { ok: false, error: "Instagram posts need a picture." } });
  });

  it("a retry only re-sends the page that failed — never double-posts the one that worked", async () => {
    const instagram = jest.fn().mockRejectedValueOnce(new SocialError("busy")).mockResolvedValueOnce("IG9");
    const { service, client } = build({ postToInstagram: instagram });
    const first = await service.create({ ...dto, mode: "now" });
    const second = await service.publish(first.id);
    expect(client.postToFacebook).toHaveBeenCalledTimes(1);
    expect(instagram).toHaveBeenCalledTimes(2);
    expect(second.status).toBe("PUBLISHED");
  });

  it("marks FAILED when nothing could be sent", async () => {
    const boom = jest.fn(async () => { throw new SocialError("expired", true); });
    const { service } = build({ postToFacebook: boom, postToInstagram: boom });
    expect((await service.create({ ...dto, mode: "now" })).status).toBe("FAILED");
  });
});

describe("inbox and replies", () => {
  it("merges sources newest first and reports a failing source instead of failing entirely", async () => {
    const item = (id: string, createdAt: string) => ({ id, channel: "facebook" as const, kind: "comment" as const, text: "t", author: "a", createdAt });
    const { service } = build({
      facebookComments: jest.fn(async () => [item("old", "2026-09-20T00:00:00Z")]),
      instagramComments: jest.fn(async () => { throw new SocialError("permission missing"); }),
      facebookMessages: jest.fn(async () => [item("new", "2026-09-21T00:00:00Z")]),
    });
    const { items, errors } = await service.inbox();
    expect(items.map((i) => i.id)).toEqual(["new", "old"]);
    expect(errors).toEqual(["Instagram comments: permission missing"]);
  });

  it("turns a social failure into a readable error and refuses Instagram DMs", async () => {
    const { service } = build({ replyToComment: jest.fn(async () => { throw new SocialError("Facebook says no."); }) });
    await expect(service.reply({ channel: "facebook", kind: "comment", targetId: "c1", message: "Hi" })).rejects.toThrow("Facebook says no.");
    await expect(service.reply({ channel: "instagram", kind: "message", targetId: "u1", message: "Hi" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
