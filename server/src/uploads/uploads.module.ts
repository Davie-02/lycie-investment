import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { MediaController } from "./media.controller";
import { UploadsService } from "./uploads.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UploadsController, MediaController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
