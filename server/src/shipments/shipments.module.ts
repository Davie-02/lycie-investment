import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ShipmentsService } from "./shipments.service";
import { CustomerLookupController, ShipmentsController } from "./shipments.controller";

@Module({
  imports: [AuthModule],
  controllers: [ShipmentsController, CustomerLookupController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
