import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AlertsService } from "./alerts.service";
import { AlertsAdminController, CustomerAlertsController } from "./alerts.controller";
import { AlertsCron } from "./alerts.cron";

@Module({
  imports: [AuthModule],
  controllers: [CustomerAlertsController, AlertsAdminController],
  providers: [AlertsService, AlertsCron],
})
export class AlertsModule {}
