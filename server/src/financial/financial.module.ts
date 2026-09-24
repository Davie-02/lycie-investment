import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UploadsModule } from "../uploads/uploads.module";
import { PurchasesModule } from "../purchases/purchases.module";
import { FinancialController } from "./financial.controller";
import { FinancialService } from "./financial.service";

@Module({
	imports: [AuthModule, UploadsModule, PurchasesModule],
	controllers: [FinancialController],
	providers: [FinancialService],
})
export class FinancialModule {}