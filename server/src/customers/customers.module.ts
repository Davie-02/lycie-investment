import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { CustomersController } from "./customers.controller";
import { CustomerMessagesController } from "./customer-messages.controller";
import { CustomersAdminController } from "./customers.admin.controller";
import { CustomersService } from "./customers.service";
import { SignInController } from "./sign-in.controller";

@Module({
	imports: [AuthModule, ReferralsModule],
	controllers: [CustomersController, CustomersAdminController, CustomerMessagesController, SignInController],
	providers: [CustomersService],
	exports: [CustomersService],
})
export class CustomersModule {}