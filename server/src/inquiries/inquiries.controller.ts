import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { InquiriesService } from "./inquiries.service";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  create(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.inquiriesService.findAll();
  }
}
