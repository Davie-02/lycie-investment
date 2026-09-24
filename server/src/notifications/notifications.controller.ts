import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { NotificationsService } from "./notifications.service";

/** Whether WhatsApp notifications are switched on (shown in the admin so staff know how customers are reached). */
@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("status")
  status() {
    return { whatsapp: this.notifications.whatsappReady, template: process.env.WHATSAPP_TEMPLATE_NAME ?? null };
  }
}
