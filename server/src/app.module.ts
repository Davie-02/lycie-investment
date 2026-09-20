import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailModule } from "./email/email.module";
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
import { CustomersModule } from "./customers/customers.module";
import { FinancialModule } from "./financial/financial.module";
import { TestimonialsModule } from "./testimonials/testimonials.module";
import { FaqModule } from "./faq/faq.module";
import { BlogPostsModule } from "./blog-posts/blog-posts.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { LycieModule } from "./lycie/lycie.module";
import { ContentAdminModule } from "./content-admin/content-admin.module";
import { EventsModule } from "./events/events.module";
import { LikesModule } from "./likes/likes.module";
import { ContactAdminModule } from "./contact-admin/contact-admin.module";
import { InsightsModule } from "./insights/insights.module";

@Module({
  imports: [
    // Global default: generous enough that normal browsing never hits it
    // (a single page load can easily make 3-4 GET requests), but still a
    // real ceiling against scripted abuse. Login/register endpoints have
    // their own much stricter limit — see auth.controller.ts and
    // customers.controller.ts — since brute-forcing a password is the
    // attack this kind of limit actually needs to stop.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // Enables @Cron() decorators (used by the daily hire-reminder job).
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
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
    CustomersModule,
    FinancialModule,
    TestimonialsModule,
    FaqModule,
    BlogPostsModule,
    ReviewsModule,
    LycieModule,
    ContentAdminModule,
    EventsModule,
    LikesModule,
    ContactAdminModule,
    InsightsModule,
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
