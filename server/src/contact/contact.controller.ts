import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ContactService } from "./contact.service";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("contact-messages")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  create(@Body() dto: CreateContactMessageDto) {
    return this.contactService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.contactService.findAll();
  }
}
