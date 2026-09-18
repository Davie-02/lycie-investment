import { Module } from "@nestjs/common";
import { CmsController } from "./cms.controller";
import { CmsService } from "./cms.service";
import { StrapiClientService } from "./strapi-client.service";

@Module({
  controllers: [CmsController],
  providers: [CmsService, StrapiClientService],
})
export class CmsModule {}
