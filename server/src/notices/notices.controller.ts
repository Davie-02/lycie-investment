import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { NoticesService } from "./notices.service";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateNoticeDto } from "./dto/update-notice.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("notices")
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  findActive() {
    return this.noticesService.findActive();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("all")
  findAll() {
    return this.noticesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Post()
  create(@Body() dto: CreateNoticeDto) {
    return this.noticesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateNoticeDto) {
    return this.noticesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.noticesService.remove(id);
  }
}
