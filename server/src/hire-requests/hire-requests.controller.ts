import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { HireRequestsService } from "./hire-requests.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { UpdateHireRequestStatusDto } from "./dto/update-hire-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("hire-requests")
export class HireRequestsController {
  constructor(private readonly hireRequestsService: HireRequestsService) {}

  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateHireRequestDto, @CurrentCustomerId() customerId?: string) {
    return this.hireRequestsService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get()
  findAll() {
    return this.hireRequestsService.findAll();
  }

  // Must come before ":id" so "bookings" isn't captured as an :id param.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("bookings")
  findBookings() {
    return this.hireRequestsService.findBookings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  @Patch(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: { sub: string }) {
    return this.hireRequestsService.cancelByCustomer(id, user.sub);
  }
}
