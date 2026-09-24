import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GuidesService } from "./guides.service";
import { GuidesAdminController, MyGuidesController } from "./guides.controller";

@Module({
  imports: [AuthModule],
  controllers: [MyGuidesController, GuidesAdminController],
  providers: [GuidesService],
})
export class GuidesModule {}
