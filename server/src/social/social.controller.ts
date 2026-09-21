import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SocialService } from "./social.service";
import { CreateSocialPostDto, ReplyDto } from "./dto/social.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

/** Admin only (Owner/Manager): post to the company's social pages and answer what people say back. */
@Controller("social")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "MANAGER")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /** Which pages are connected. */
  @Get("status")
  status() {
    return this.social.status();
  }

  @Get("posts")
  posts() {
    return this.social.list();
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("posts")
  create(@Body() dto: CreateSocialPostDto, @CurrentUser() user: { name: string }) {
    return this.social.create(dto, user.name);
  }

  /** Sends (or retries) a saved post. */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("posts/:id/publish")
  @HttpCode(200)
  publish(@Param("id") id: string) {
    return this.social.publish(id);
  }

  @Delete("posts/:id")
  remove(@Param("id") id: string) {
    return this.social.remove(id);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get("inbox")
  inbox() {
    return this.social.inbox();
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("reply")
  @HttpCode(200)
  reply(@Body() dto: ReplyDto) {
    return this.social.reply(dto);
  }
}
