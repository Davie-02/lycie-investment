import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { LikesService } from "./likes.service";
import { LIKE_KINDS, LikeKind, SetLikeDto } from "./dto/like.dto";

/** Public on purpose: liking needs no account. */
@Controller("likes")
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post()
  set(@Body() dto: SetLikeDto) {
    return this.likes.set(dto);
  }

  // GET /likes/counts?kind=vehicle&ids=a,b,c
  @Get("counts")
  async counts(@Query("kind") kind: string, @Query("ids") ids = "") {
    if (!LIKE_KINDS.includes(kind as LikeKind)) throw new BadRequestException("Unknown kind.");
    const list = ids.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 100);
    return { counts: await this.likes.counts(kind as LikeKind, list) };
  }
}
