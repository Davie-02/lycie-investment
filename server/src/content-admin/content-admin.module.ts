import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContentAdminController } from "./content-admin.controller";
import { ContentAdminService } from "./content-admin.service";

@Module({
  imports: [AuthModule],
  controllers: [ContentAdminController],
  providers: [ContentAdminService],
})
export class ContentAdminModule {}
