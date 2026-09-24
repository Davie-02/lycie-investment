import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReferralsService } from "./referrals.service";
import { MyReferralController, ReferralsAdminController } from "./referrals.controller";

@Module({
  imports: [AuthModule],
  controllers: [MyReferralController, ReferralsAdminController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
