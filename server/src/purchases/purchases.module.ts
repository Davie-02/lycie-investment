import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingModule } from "../pricing/pricing.module";
import { MyPurchasesController, PurchasesAdminController } from "./purchases.controller";
import { PurchasesService } from "./purchases.service";

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [MyPurchasesController, PurchasesAdminController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
