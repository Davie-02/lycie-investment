import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

/** The customer's inbox inside their Lycie profile — messages staff sent from the admin. */
@Controller("customers/me/messages")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerMessagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles("CUSTOMER")
  @Get()
  async list(@CurrentUser() user: { sub: string }) {
    const items = await this.prisma.customerMessage.findMany({
      where: { customerId: user.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, subject: true, body: true, sentByName: true, readAt: true, createdAt: true },
    });
    return { items, unread: items.filter((m) => !m.readAt).length };
  }

  @Roles("CUSTOMER")
  @HttpCode(200)
  @Post("read")
  async markAllRead(@CurrentUser() user: { sub: string }) {
    const result = await this.prisma.customerMessage.updateMany({
      where: { customerId: user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }
}
