import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContactAdminController } from "./contact-admin.controller";
import { ContactAdminService } from "./contact-admin.service";

@Module({
  imports: [AuthModule],
  controllers: [ContactAdminController],
  providers: [ContactAdminService],
})
export class ContactAdminModule {}
