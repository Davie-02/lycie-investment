import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SocialPost } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { absoluteUrl } from "../seo/seo-html";
import { siteUrl } from "../common/site-url";
import { MetaClient, SocialError, type Channel, type InboxItem } from "./meta.client";
import { CreateSocialPostDto, ReplyDto } from "./dto/social.dto";

interface ChannelResult {
  ok: boolean;
  /** The id Facebook/Instagram gave the published post. */
  id?: string;
  error?: string;
}

/**
 * The company's social media desk: write a post once, send it to Facebook and/or Instagram now or at
 * a set time, and answer the comments and messages people send back — all from the admin.
 * Talks to Meta through MetaClient; nothing is sent without an admin pressing the button.
 */
@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaClient
  ) {}

  status() {
    return this.meta.status();
  }

  list() {
    return this.prisma.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  }

  async create(dto: CreateSocialPostDto, author?: string): Promise<SocialPost> {
    const scheduledFor = dto.mode === "schedule" ? this.futureDate(dto.scheduledFor) : null;
    const post = await this.prisma.socialPost.create({
      data: {
        message: dto.message.trim(),
        imageUrl: dto.imageUrl || null,
        linkUrl: dto.linkUrl || null,
        channels: [...new Set(dto.channels)],
        status: dto.mode === "schedule" ? "SCHEDULED" : "DRAFT",
        scheduledFor,
        createdBy: author ?? null,
      },
    });
    return dto.mode === "now" ? this.publish(post.id) : post;
  }

  private futureDate(value?: string): Date {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 60_000) {
      throw new BadRequestException("Choose a time at least a minute from now.");
    }
    return date;
  }

  /** Sends a post to every selected page that hasn't succeeded yet (so a retry never double-posts). */
  async publish(id: string): Promise<SocialPost> {
    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found.");
    if (post.status === "PUBLISHED") return post;

    const previous = (post.results ?? {}) as unknown as Record<string, ChannelResult>;
    const results: Record<string, ChannelResult> = { ...previous };
    const imageUrl = absoluteUrl(siteUrl(), post.imageUrl);

    for (const channel of post.channels as Channel[]) {
      if (results[channel]?.ok) continue;
      try {
        const input = { message: post.message, imageUrl, linkUrl: post.linkUrl };
        const postId = channel === "facebook" ? await this.meta.postToFacebook(input) : await this.meta.postToInstagram(input);
        results[channel] = { ok: true, id: postId };
      } catch (error) {
        const message = error instanceof SocialError ? error.message : "Something went wrong while posting.";
        if (!(error instanceof SocialError)) this.logger.error(`Posting to ${channel} failed: ${error instanceof Error ? error.message : error}`);
        results[channel] = { ok: false, error: message };
      }
    }

    const outcomes = (post.channels as string[]).map((channel) => results[channel]?.ok ?? false);
    const status = outcomes.every(Boolean) ? "PUBLISHED" : outcomes.some(Boolean) ? "PARTIAL" : "FAILED";
    return this.prisma.socialPost.update({
      where: { id },
      data: { results: results as unknown as Prisma.InputJsonValue, status, publishedAt: status === "FAILED" ? null : new Date() },
    });
  }

  async remove(id: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found.");
    await this.prisma.socialPost.delete({ where: { id } });
    return { deleted: true };
  }

  /** Called every few minutes: publishes scheduled posts whose time has come. */
  async publishDue(): Promise<number> {
    const due = await this.prisma.socialPost.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } }, take: 10 });
    for (const post of due) {
      try {
        await this.publish(post.id);
      } catch (error) {
        this.logger.warn(`Scheduled post ${post.id} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    return due.length;
  }

  // ------------------------------------------------------------------ inbox

  /** Comments and messages from every connected page, newest first. A failing source is reported, not fatal. */
  async inbox(): Promise<{ items: InboxItem[]; errors: string[] }> {
    const sources: Array<[string, () => Promise<InboxItem[]>]> = [
      ["Facebook comments", () => this.meta.facebookComments()],
      ["Instagram comments", () => this.meta.instagramComments()],
      ["Facebook messages", () => this.meta.facebookMessages()],
    ];
    const items: InboxItem[] = [];
    const errors: string[] = [];
    await Promise.all(
      sources.map(async ([label, load]) => {
        try {
          items.push(...(await load()));
        } catch (error) {
          errors.push(`${label}: ${error instanceof SocialError ? error.message : "couldn't be loaded"}`);
        }
      })
    );
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { items, errors };
  }

  async reply(dto: ReplyDto): Promise<{ sent: true }> {
    if (dto.kind === "message" && dto.channel === "instagram") throw new BadRequestException("Instagram messages can't be answered from here yet — reply in the Instagram app.");
    try {
      if (dto.kind === "comment") await this.meta.replyToComment(dto.channel, dto.targetId, dto.message.trim());
      else await this.meta.replyToMessage(dto.targetId, dto.message.trim());
    } catch (error) {
      if (error instanceof SocialError) throw new BadRequestException(error.message);
      throw error;
    }
    return { sent: true };
  }
}
