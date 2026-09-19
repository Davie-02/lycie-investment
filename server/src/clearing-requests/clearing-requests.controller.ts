import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ClearingRequestsService } from "./clearing-requests.service";
import { CreateClearingRequestDto } from "./dto/create-clearing-request.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";

@Controller("clearing-requests")
export class ClearingRequestsController {
  constructor(private readonly clearingRequestsService: ClearingRequestsService) {}

  // Public submission endpoint that triggers an email send + DB write —
  // throttled the same as the other public form endpoints to limit
  // spam/abuse cost, separate from the global per-IP floor.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateClearingRequestDto, @CurrentCustomerId() customerId?: string) {
    return this.clearingRequestsService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get()
  findAll() {
    return this.clearingRequestsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateRequestStatusDto) {
    return this.clearingRequestsService.updateStatus(id, dto);
  }
}
