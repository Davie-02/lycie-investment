import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ContactService } from "./contact.service";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";

@Controller("contact-messages")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateContactMessageDto, @CurrentCustomerId() customerId?: string) {
    return this.contactService.create(dto, customerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.contactService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateRequestStatusDto) {
    return this.contactService.updateStatus(id, dto);
  }
}
