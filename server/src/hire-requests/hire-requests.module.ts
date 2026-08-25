import { Module } from "@nestjs/common";
import { HireRequestsController } from "./hire-requests.controller";
import { HireRequestsService } from "./hire-requests.service";
import { HireRemindersCron } from "./hire-reminders.cron";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [HireRequestsController],
  providers: [HireRequestsService, HireRemindersCron],
})
export class HireRequestsModule {}
