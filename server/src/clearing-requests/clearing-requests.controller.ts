import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ClearingRequestsService } from "./clearing-requests.service";
import { CreateClearingRequestDto } from "./dto/create-clearing-request.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("clearing-requests")
export class ClearingRequestsController {
  constructor(private readonly clearingRequestsService: ClearingRequestsService) {}

  @Post()
  create(@Body() dto: CreateClearingRequestDto) {
    return this.clearingRequestsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.clearingRequestsService.findAll();
  }
}
