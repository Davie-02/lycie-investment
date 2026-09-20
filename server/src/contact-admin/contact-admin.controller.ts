import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ContactAdminService } from "./contact-admin.service";
import { LogContactDto, REQUEST_TYPES, RequestType, SendMessageDto } from "./dto/contact.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

function parseType(value: string): RequestType {
  if (!REQUEST_TYPES.includes(value as RequestType)) throw new BadRequestException("Unknown request type.");
  return value as RequestType;
}

@Controller("contact-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactAdminController {
  constructor(private readonly contact: ContactAdminService) {}

  // Declared before the ":type" routes so "email-status" isn't read as a type.
  @Roles("OWNER", "MANAGER")
  @Get("email-status")
  emailStatus() {
    return this.contact.emailStatus();
  }

  @Roles("OWNER")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("test-email")
  testEmail(@CurrentUser() user: { sub: string }) {
    return this.contact.sendTestEmail(user.sub);
  }

  @Roles("OWNER", "MANAGER")
  @Get(":type/:id")
  history(@Param("type") type: string, @Param("id") id: string) {
    return this.contact.history(parseType(type), id);
  }

  @Roles("OWNER", "MANAGER")
  @Post(":type/:id/log")
  log(@Param("type") type: string, @Param("id") id: string, @Body() dto: LogContactDto, @CurrentUser() user: { sub: string }) {
    return this.contact.log(parseType(type), id, user.sub, dto.method, dto.note);
  }

  @Roles("OWNER", "MANAGER")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post(":type/:id/email")
  email(@Param("type") type: string, @Param("id") id: string, @Body() dto: SendMessageDto, @CurrentUser() user: { sub: string }) {
    return this.contact.sendEmail(parseType(type), id, user.sub, dto.subject, dto.body);
  }

  @Roles("OWNER", "MANAGER")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post(":type/:id/message")
  profileMessage(@Param("type") type: string, @Param("id") id: string, @Body() dto: SendMessageDto, @CurrentUser() user: { sub: string }) {
    return this.contact.sendProfileMessage(parseType(type), id, user.sub, dto.subject, dto.body);
  }
}
