import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { WriterService } from "./writer.service";
import { WriteDto } from "./dto/write.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("lycie/write")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WriterController {
  constructor(private readonly writer: WriterService) {}

  // Spends AI quota: tight per-minute throttle on top of the daily cap.
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Roles("OWNER", "MANAGER")
  @HttpCode(200)
  @Post()
  write(@Body() dto: WriteDto) {
    return this.writer.write(dto);
  }
}
