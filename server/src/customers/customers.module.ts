import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersController } from "./customers.controller";
import { CustomersAdminController } from "./customers.admin.controller";
import { CustomersService } from "./customers.service";

@Module({
	imports: [AuthModule],
	controllers: [CustomersController, CustomersAdminController],
	providers: [CustomersService],
	exports: [CustomersService],
})
export class CustomersModule {}