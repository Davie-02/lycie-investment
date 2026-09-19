import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { REVIEW_STATUSES, ReviewStatus, UpdateReviewStatusDto } from "./dto/update-review-status.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OptionalCustomerGuard } from "../auth/optional-customer.guard";
import { CurrentCustomerId } from "../auth/current-customer-id.decorator";

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, Math.floor(parsed))) : fallback;
}

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Public: approved reviews only. Omit vehicleId for company-wide reviews.
  @Get()
  listPublic(
    @Query("vehicleId") vehicleId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.reviews.listPublic(vehicleId, parsePositiveInt(page, 1, 10_000), parsePositiveInt(pageSize, 10, 50));
  }

  // Public submission — throttled like the other public forms since each
  // one writes to the DB and sends an admin email.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(@Body() dto: CreateReviewDto, @CurrentCustomerId() customerId?: string) {
    return this.reviews.create(dto, customerId);
  }

  // Declared before the ":id" routes so "all" is never captured as an id.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("all")
  listAdmin(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const safeStatus = REVIEW_STATUSES.includes(status as ReviewStatus) ? (status as ReviewStatus) : undefined;
    return this.reviews.listAdmin(safeStatus, parsePositiveInt(page, 1, 10_000), parsePositiveInt(pageSize, 20, 100));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateReviewStatusDto) {
    return this.reviews.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.reviews.remove(id);
  }
}
