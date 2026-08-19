import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // Kept short deliberately — this is a small admin team, not a
        // public-facing session, so there's no real cost to re-logging in
        // periodically, and it limits how long a stolen/leaked token stays
        // useful. Override via JWT_EXPIRES_IN if 2h turns out wrong for
        // how the team actually works.
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "2h" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
