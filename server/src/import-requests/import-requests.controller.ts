import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ImportRequestsService } from "./import-requests.service";
import { CreateImportRequestDto } from "./dto/create-import-request.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("import-requests")
export class ImportRequestsController {
  constructor(private readonly importRequestsService: ImportRequestsService) {}

  @Post()
  create(@Body() dto: CreateImportRequestDto) {
    return this.importRequestsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.importRequestsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateRequestStatusDto) {
    return this.importRequestsService.updateStatus(id, dto);
  }
}
