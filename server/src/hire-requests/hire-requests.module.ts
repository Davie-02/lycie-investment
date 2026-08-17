import { Module } from "@nestjs/common";
import { HireRequestsController } from "./hire-requests.controller";
import { HireRequestsService } from "./hire-requests.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [HireRequestsController],
  providers: [HireRequestsService],
})
export class HireRequestsModule {}
