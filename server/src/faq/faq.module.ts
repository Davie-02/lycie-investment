import { Module } from "@nestjs/common";
import { FaqController } from "./faq.controller";
import { FaqService } from "./faq.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [FaqController],
  providers: [FaqService],
})
export class FaqModule {}
