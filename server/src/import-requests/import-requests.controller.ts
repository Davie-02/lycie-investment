import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ImportRequestsService } from "./import-requests.service";
import { CreateImportRequestDto } from "./dto/create-import-request.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";

@Controller("import-requests")
export class ImportRequestsController {
  constructor(private readonly importRequestsService: ImportRequestsService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateImportRequestDto, @CurrentCustomerId() customerId?: string) {
    return this.importRequestsService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
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
