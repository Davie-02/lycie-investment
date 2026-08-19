import { Module } from "@nestjs/common";
import { ClearingRequestsController } from "./clearing-requests.controller";
import { ClearingRequestsService } from "./clearing-requests.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ClearingRequestsController],
  providers: [ClearingRequestsService],
})
export class ClearingRequestsModule {}
