import { Module } from "@nestjs/common";
import { ImportRequestsController } from "./import-requests.controller";
import { ImportRequestsService } from "./import-requests.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportRequestsController],
  providers: [ImportRequestsService],
})
export class ImportRequestsModule {}
