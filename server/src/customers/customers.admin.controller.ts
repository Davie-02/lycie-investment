import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerCaseDto } from "./dto/create-customer-case.dto";
import { CreateCustomerCaseUpdateDto } from "./dto/create-customer-case-update.dto";

@Controller("customer-cases")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "MANAGER")
export class CustomersAdminController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerCaseDto) {
    return this.customers.createCase(dto);
  }

  @Post(":id/updates")
  addUpdate(@Param("id") id: string, @Body() dto: CreateCustomerCaseUpdateDto) {
    return this.customers.addCaseUpdate(id, dto);
  }
}