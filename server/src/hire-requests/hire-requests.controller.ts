import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { HireRequestsService } from "./hire-requests.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("hire-requests")
export class HireRequestsController {
  constructor(private readonly hireRequestsService: HireRequestsService) {}

  @Post()
  create(@Body() dto: CreateHireRequestDto) {
    return this.hireRequestsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.hireRequestsService.findAll();
  }
}
