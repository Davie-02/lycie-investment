import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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

  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateClearingRequestDto, @CurrentCustomerId() customerId?: string) {
    return this.clearingRequestsService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard)
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
