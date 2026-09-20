import { BadRequestException, Body, Controller, Get, Param, ParseArrayPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString } from "class-validator";
import { ContentAdminService } from "./content-admin.service";
import { CONTENT_TYPES, ContentAction, ContentState, ContentType } from "./content-state";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

class BulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(["publish", "unpublish", "archive", "restore", "delete"])
  action!: ContentAction;
}

function parseType(value: string): ContentType {
  if (!CONTENT_TYPES.includes(value as ContentType)) throw new BadRequestException("Unknown content type.");
  return value as ContentType;
}

const int = (value: string | undefined, fallback: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(1, Math.floor(n))) : fallback;
};

/** Admin-only listing and state changes for every kind of content. */
@Controller("content-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentAdminController {
  constructor(private readonly content: ContentAdminService) {}

  @Roles("OWNER", "MANAGER")
  @Get(":type")
  list(
    @Param("type") type: string,
    @Query("state") state?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const safeState = (["published", "unpublished", "archived"].includes(state ?? "") ? state : "all") as ContentState | "all";
    return this.content.list(parseType(type), safeState, q?.slice(0, 100), int(page, 1, 10_000), int(pageSize, 20, 100));
  }

  @Roles("OWNER", "MANAGER")
  @Post(":type/bulk")
  bulk(@Param("type") type: string, @Body() dto: BulkDto) {
    return this.content.apply(parseType(type), dto.ids, dto.action);
  }

  @Roles("OWNER", "MANAGER")
  @Post(":type/:id/duplicate")
  duplicate(@Param("type") type: string, @Param("id") id: string) {
    return this.content.duplicate(parseType(type), id);
  }
}
