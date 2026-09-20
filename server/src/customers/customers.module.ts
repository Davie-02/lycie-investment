import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersController } from "./customers.controller";
import { CustomerMessagesController } from "./customer-messages.controller";
import { CustomersAdminController } from "./customers.admin.controller";
import { CustomersService } from "./customers.service";

@Module({
	imports: [AuthModule],
	controllers: [CustomersController, CustomersAdminController, CustomerMessagesController],
	providers: [CustomersService],
	exports: [CustomersService],
})
export class CustomersModule {}