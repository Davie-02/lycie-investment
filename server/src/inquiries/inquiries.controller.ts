import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { InquiriesService } from "./inquiries.service";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";

@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateInquiryDto, @CurrentCustomerId() customerId?: string) {
    return this.inquiriesService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.inquiriesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateRequestStatusDto) {
    return this.inquiriesService.updateStatus(id, dto);
  }
}
