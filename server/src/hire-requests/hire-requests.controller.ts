import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { HireRequestsService } from "./hire-requests.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { UpdateHireRequestStatusDto } from "./dto/update-hire-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

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

  // Must come before ":id" so "bookings" isn't captured as an :id param.
  @UseGuards(JwtAuthGuard)
  @Get("bookings")
  findBookings() {
    return this.hireRequestsService.findBookings();
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.hireRequestsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateHireRequestStatusDto) {
    return this.hireRequestsService.updateStatus(id, dto);
  }
}
