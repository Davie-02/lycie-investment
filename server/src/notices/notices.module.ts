import { Module } from "@nestjs/common";
import { NoticesController } from "./notices.controller";
import { NoticesService } from "./notices.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
