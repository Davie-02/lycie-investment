import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContactMessageDto) {
    return this.prisma.contactMessage.create({ data: dto });
  }

  findAll() {
    return this.prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  }
}
