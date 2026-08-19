import { Module } from "@nestjs/common";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesService } from "./inquiries.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [InquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
