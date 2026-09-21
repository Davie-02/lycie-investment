import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { SeoController } from "./seo.controller";
import { SeoService } from "./seo.service";

@Module({
  imports: [PricingModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
