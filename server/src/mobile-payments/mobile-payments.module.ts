import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PurchasesModule } from "../purchases/purchases.module";
import { MobilePaymentsService } from "./mobile-payments.service";
import { CustomerMobilePaymentsController, MobilePaymentsAdminController, MobilePaymentsWebhookController } from "./mobile-payments.controller";

@Module({
  imports: [AuthModule, PurchasesModule],
  // The webhook controller comes before the admin one so "/mobile-payments/webhook" isn't read as an admin route.
  controllers: [MobilePaymentsWebhookController, CustomerMobilePaymentsController, MobilePaymentsAdminController],
  providers: [MobilePaymentsService],
})
export class MobilePaymentsModule {}
