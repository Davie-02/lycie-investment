import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ImportRequestsService } from "./import-requests.service";
import { CreateImportRequestDto } from "./dto/create-import-request.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

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
}
