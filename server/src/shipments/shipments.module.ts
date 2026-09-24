import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ShipmentsService } from "./shipments.service";
import { CustomerLookupController, ShipmentsController, TrackingController } from "./shipments.controller";

@Module({
  imports: [AuthModule],
  controllers: [ShipmentsController, CustomerLookupController, TrackingController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
