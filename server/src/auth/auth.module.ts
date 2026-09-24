import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { OptionalCustomerGuard } from "./optional-customer.guard";
import { SessionService } from "./session.service";
import { SocialIdentityService } from "./social-identity";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // Only ever accept tokens signed the way we sign them; a token claiming
        // another algorithm (e.g. "none") is refused outright.
        verifyOptions: { algorithms: ["HS256"] },
        // Only a default: SessionService.issue() sets the real lifetime per
        // sign-in (short normally, long for "keep me signed in"). Kept short so
        // any token minted without an explicit lifetime is low-risk.
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "2h", algorithm: "HS256" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, SocialIdentityService, JwtAuthGuard, RolesGuard, OptionalCustomerGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, OptionalCustomerGuard, JwtModule, SessionService, SocialIdentityService],
})
export class AuthModule {}
