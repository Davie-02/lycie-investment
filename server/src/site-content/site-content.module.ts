import { Module } from "@nestjs/common";
import { SiteContentController } from "./site-content.controller";
import { SiteContentService } from "./site-content.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [SiteContentController],
  providers: [SiteContentService],
})
export class SiteContentModule {}
