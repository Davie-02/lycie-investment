import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean } from "class-validator";
import { DocumentsService } from "./documents.service";
import { MAX_DOCUMENT_BYTES } from "./document-extract.util";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

/** Files Lycie learns from. Admin only — uploaded text becomes part of what she tells customers. */
@Controller("lycie/documents")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Roles("OWNER", "MANAGER")
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.documents.ingest(file);
  }

  @Roles("OWNER", "MANAGER")
  @Get()
  list() {
    return this.documents.list();
  }

  @Roles("OWNER", "MANAGER")
  @Get(":id")
  sections(@Param("id") id: string) {
    return this.documents.sections(id);
  }

  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  async setActive(@Param("id") id: string, @Body() dto: SetActiveDto) {
    await this.documents.setActive(id, dto.isActive);
    return { isActive: dto.isActive };
  }

  @Roles("OWNER", "MANAGER")
  @HttpCode(204)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.documents.remove(id);
  }
}
