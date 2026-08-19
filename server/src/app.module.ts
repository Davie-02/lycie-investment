import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { VehiclesModule } from "./vehicles/vehicles.module";
import { HireVehiclesModule } from "./hire-vehicles/hire-vehicles.module";
import { InquiriesModule } from "./inquiries/inquiries.module";
import { ImportRequestsModule } from "./import-requests/import-requests.module";
import { ClearingRequestsModule } from "./clearing-requests/clearing-requests.module";
import { HireRequestsModule } from "./hire-requests/hire-requests.module";
import { ContactModule } from "./contact/contact.module";
import { AuthModule } from "./auth/auth.module";
import { AdminUsersModule } from "./admin-users/admin-users.module";
import { SiteContentModule } from "./site-content/site-content.module";
import { NoticesModule } from "./notices/notices.module";
import { UploadsModule } from "./uploads/uploads.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    // Applies globally as a safety net (see the APP_GUARD provider below).
    // 20 requests per 60 seconds per IP is generous for normal browsing —
    // the intent is to blunt scripted form-spam on the public POST
    // endpoints, not to throttle real visitors.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    SiteContentModule,
    NoticesModule,
    VehiclesModule,
    HireVehiclesModule,
    InquiriesModule,
    ImportRequestsModule,
    ClearingRequestsModule,
    HireRequestsModule,
    ContactModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
