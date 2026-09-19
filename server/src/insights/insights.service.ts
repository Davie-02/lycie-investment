import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { analyzeText, SentimentLabel } from "./sentiment.util";
import {
  buildRecommendations,
  HireSignal,
  Recommendation,
  ThemeSignal,
  VehicleSignal,
} from "./recommendations.util";

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WEEKS = 8;
const TOP_THEMES = 12;

interface FeedbackItem {
  date: Date;
  score: number;
  label: SentimentLabel;
  keywords: string[];
}

type SentimentCounts = Record<SentimentLabel, number>;

function emptyCounts(): SentimentCounts {
  return { positive: 0, neutral: 0, negative: 0 };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday 00:00 UTC of the week containing `date`. */
function startOfUtcWeek(date: Date): Date {
  const day = startOfUtcDay(date);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Counts one view of a vehicle page. Only a per-vehicle, per-day total is
   * stored — no IP, cookie, or user identifier — so this can't be used to
   * track individuals.
   */
  async recordVehicleView(vehicleId: string): Promise<{ recorded: true }> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException("Vehicle not found.");

    const day = startOfUtcDay(new Date());
    await this.prisma.vehicleViewStat.upsert({
      where: { vehicleId_day: { vehicleId, day } },
      create: { vehicleId, day, views: 1 },
      update: { views: { increment: 1 } },
    });
    return { recorded: true };
  }

  async getOverview() {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const since90 = new Date(now.getTime() - 90 * DAY_MS);
    const trendStart = new Date(startOfUtcWeek(now).getTime() - (TREND_WEEKS - 1) * 7 * DAY_MS);

    const [
      vehicles,
      hireVehicles,
      savedCounts,
      viewSums,
      inquiryCounts,
      hireCounts,
      reviews,
      contactMessages,
      inquiryMessages,
    ] = await Promise.all([
      this.prisma.vehicle.findMany({
        select: { id: true, make: true, model: true, year: true, status: true, createdAt: true },
      }),
      this.prisma.hireVehicle.findMany({ select: { id: true, name: true, available: true } }),
      this.prisma.savedVehicle.groupBy({ by: ["vehicleId"], _count: { _all: true } }),
      this.prisma.vehicleViewStat.groupBy({
        by: ["vehicleId"],
        where: { day: { gte: startOfUtcDay(since30) } },
        _sum: { views: true },
      }),
      this.prisma.inquiry.groupBy({
        by: ["vehicleId"],
        where: { vehicleId: { not: null }, createdAt: { gte: since90 } },
        _count: { _all: true },
      }),
      this.prisma.hireRequest.groupBy({
        by: ["vehicleId", "status"],
        where: { createdAt: { gte: since90 } },
        _count: { _all: true },
      }),
      this.prisma.review.findMany({
        where: { status: { not: "rejected" } },
        select: {
          rating: true,
          status: true,
          sentiment: true,
          sentimentScore: true,
          keywords: true,
          vehicleId: true,
          createdAt: true,
        },
      }),
      this.prisma.contactMessage.findMany({
        where: { createdAt: { gte: since90 } },
        select: { subject: true, message: true, createdAt: true },
      }),
      this.prisma.inquiry.findMany({
        where: { createdAt: { gte: since90 }, message: { not: null } },
        select: { message: true, createdAt: true },
      }),
    ]);

    const approved = reviews.filter((r) => r.status === "approved");
    const pendingReviews = reviews.filter((r) => r.status === "pending").length;

    // Reviews carry a stored sentiment; messages are analysed on the fly
    // (their volume is small and they're never stored with a score).
    const reviewFeedback: FeedbackItem[] = reviews.map((r) => ({
      date: r.createdAt,
      score: r.sentimentScore,
      label: r.sentiment as SentimentLabel,
      keywords: r.keywords,
    }));
    const messageFeedback: FeedbackItem[] = [
      ...contactMessages.map((m) => ({ date: m.createdAt, text: `${m.subject}. ${m.message}` })),
      ...inquiryMessages.map((m) => ({ date: m.createdAt, text: m.message ?? "" })),
    ]
      .filter((m) => m.text.trim().length > 0)
      .map((m) => {
        const result = analyzeText(m.text);
        return { date: m.date, score: result.score, label: result.label, keywords: result.keywords };
      });
    const allFeedback = [...reviewFeedback, ...messageFeedback];

    const countBy = (items: FeedbackItem[]): SentimentCounts => {
      const counts = emptyCounts();
      items.forEach((item) => (counts[item.label] += 1));
      return counts;
    };

    const themeMap = new Map<string, SentimentCounts>();
    for (const item of allFeedback) {
      for (const word of new Set(item.keywords)) {
        const counts = themeMap.get(word) ?? emptyCounts();
        counts[item.label] += 1;
        themeMap.set(word, counts);
      }
    }
    const themes = Array.from(themeMap.entries())
      .map(([word, c]) => ({ word, ...c, total: c.positive + c.neutral + c.negative }))
      .sort((a, b) => b.total - a.total || a.word.localeCompare(b.word))
      .slice(0, TOP_THEMES);

    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => approved.filter((r) => r.rating === star).length);
    const averageRating = approved.length
      ? Math.round((approved.reduce((sum, r) => sum + r.rating, 0) / approved.length) * 10) / 10
      : null;

    const weeklyTrend = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const weekStart = new Date(trendStart.getTime() + i * 7 * DAY_MS);
      const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
      const inWeek = allFeedback.filter((f) => f.date >= weekStart && f.date < weekEnd);
      const averageScore = inWeek.length
        ? Math.round((inWeek.reduce((sum, f) => sum + f.score, 0) / inWeek.length) * 100) / 100
        : null;
      return { weekStart: weekStart.toISOString().slice(0, 10), count: inWeek.length, averageScore };
    });

    const savesByVehicle = new Map(savedCounts.map((s) => [s.vehicleId, s._count._all]));
    const viewsByVehicle = new Map(viewSums.map((v) => [v.vehicleId, v._sum.views ?? 0]));
    const inquiriesByVehicle = new Map(inquiryCounts.map((i) => [i.vehicleId as string, i._count._all]));

    const vehicleSignals: VehicleSignal[] = vehicles
      .map((v) => {
        const own = approved.filter((r) => r.vehicleId === v.id);
        return {
          id: v.id,
          label: `${v.make} ${v.model} ${v.year}`,
          make: v.make,
          status: v.status,
          ageDays: Math.floor((now.getTime() - v.createdAt.getTime()) / DAY_MS),
          saves: savesByVehicle.get(v.id) ?? 0,
          views30d: viewsByVehicle.get(v.id) ?? 0,
          inquiries90d: inquiriesByVehicle.get(v.id) ?? 0,
          reviewCount: own.length,
          avgRating: own.length ? Math.round((own.reduce((s, r) => s + r.rating, 0) / own.length) * 10) / 10 : null,
        };
      })
      // Most-wanted first: an inquiry is worth far more than a view.
      .sort((a, b) => b.inquiries90d * 10 + b.saves * 3 + b.views30d - (a.inquiries90d * 10 + a.saves * 3 + a.views30d));

    const hireSignals: HireSignal[] = hireVehicles
      .map((h) => {
        const rows = hireCounts.filter((c) => c.vehicleId === h.id);
        const requests = rows.reduce((sum, c) => sum + c._count._all, 0);
        const confirmed = rows
          .filter((c) => c.status === "confirmed" || c.status === "completed")
          .reduce((sum, c) => sum + c._count._all, 0);
        return { id: h.id, name: h.name, available: h.available, requests90d: requests, confirmed90d: confirmed };
      })
      .sort((a, b) => b.requests90d - a.requests90d);

    const themeSignals: ThemeSignal[] = themes.map(({ word, positive, neutral, negative }) => ({
      word,
      positive,
      neutral,
      negative,
    }));

    const recommendations: Recommendation[] = buildRecommendations({
      vehicles: vehicleSignals,
      hireVehicles: hireSignals,
      themes: themeSignals,
      pendingReviews,
      feedbackCount: allFeedback.length,
    });

    return {
      generatedAt: now.toISOString(),
      totals: {
        reviews: reviews.length,
        pendingReviews,
        averageRating,
        feedbackCount: allFeedback.length,
        saves: savedCounts.reduce((sum, s) => sum + s._count._all, 0),
        views30d: viewSums.reduce((sum, v) => sum + (v._sum.views ?? 0), 0),
        inquiries90d: inquiryCounts.reduce((sum, i) => sum + i._count._all, 0),
      },
      sentiment: {
        reviews: countBy(reviewFeedback),
        messages: countBy(messageFeedback),
        overall: countBy(allFeedback),
      },
      ratingDistribution,
      weeklyTrend,
      themes,
      vehicles: vehicleSignals,
      hireVehicles: hireSignals,
      recommendations,
    };
  }
}
