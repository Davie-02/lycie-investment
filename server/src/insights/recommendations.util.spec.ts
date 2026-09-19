import { buildRecommendations, RecommendationInput, VehicleSignal } from "./recommendations.util";

function vehicle(overrides: Partial<VehicleSignal> = {}): VehicleSignal {
  return {
    id: "v1",
    label: "Toyota Hilux 2022",
    make: "Toyota",
    status: "available",
    ageDays: 10,
    saves: 0,
    views30d: 0,
    inquiries90d: 0,
    reviewCount: 0,
    avgRating: null,
    ...overrides,
  };
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return { vehicles: [], hireVehicles: [], themes: [], pendingReviews: 0, feedbackCount: 0, ...overrides };
}

describe("buildRecommendations", () => {
  it("says there's not enough data when nothing has happened yet", () => {
    const result = buildRecommendations(input());
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Not enough data yet");
  });

  it("says nothing needs attention when there is feedback but no issues", () => {
    const result = buildRecommendations(input({ feedbackCount: 5 }));
    expect(result[0].title).toBe("Nothing needs attention");
  });

  it("flags reviews awaiting moderation, pluralised correctly", () => {
    expect(buildRecommendations(input({ pendingReviews: 1 }))[0].title).toMatch(/1 review waiting/);
    expect(buildRecommendations(input({ pendingReviews: 3 }))[0].title).toMatch(/3 reviews waiting/);
  });

  it("flags high interest with zero inquiries on an available vehicle", () => {
    const result = buildRecommendations(input({ vehicles: [vehicle({ views30d: 20, saves: 4 })] }));
    expect(result.some((r) => r.title.includes("attention but no inquiries"))).toBe(true);
  });

  it("does not flag interest without inquiries once an inquiry exists", () => {
    const result = buildRecommendations(input({ vehicles: [vehicle({ views30d: 20, inquiries90d: 2 })] }));
    expect(result.some((r) => r.title.includes("attention but no inquiries"))).toBe(false);
  });

  it("ignores sold and reserved vehicles for stock advice", () => {
    const result = buildRecommendations(
      input({ vehicles: [vehicle({ status: "sold", views30d: 50, ageDays: 90 })] })
    );
    expect(result.every((r) => !r.vehicleId)).toBe(true);
  });

  it("flags a low average rating only with enough reviews", () => {
    const tooFew = buildRecommendations(input({ vehicles: [vehicle({ reviewCount: 1, avgRating: 1 })] }));
    expect(tooFew.some((r) => r.title.includes("low customer rating"))).toBe(false);

    const enough = buildRecommendations(input({ vehicles: [vehicle({ reviewCount: 3, avgRating: 2 })] }));
    expect(enough.some((r) => r.title.includes("low customer rating"))).toBe(true);
  });

  it("flags stale listings with no engagement", () => {
    const result = buildRecommendations(input({ vehicles: [vehicle({ ageDays: 60 })] }));
    expect(result.some((r) => r.title.includes("stale listing"))).toBe(true);
  });

  it("flags a recurring negative theme but not a balanced one", () => {
    const flagged = buildRecommendations(
      input({ themes: [{ word: "delivery", positive: 1, neutral: 0, negative: 4 }] })
    );
    expect(flagged.some((r) => r.title.includes("delivery"))).toBe(true);

    const balanced = buildRecommendations(
      input({ themes: [{ word: "price", positive: 5, neutral: 0, negative: 3 }] })
    );
    expect(balanced.some((r) => r.title.includes("price"))).toBe(false);
  });

  it("flags strong hire demand with a good confirmation rate", () => {
    const result = buildRecommendations(
      input({ hireVehicles: [{ id: "h1", name: "Toyota Hiace", available: true, requests90d: 4, confirmed90d: 3 }] })
    );
    expect(result.some((r) => r.hireVehicleId === "h1")).toBe(true);
  });

  it("highlights a dominant make once there is enough signal", () => {
    const result = buildRecommendations(
      input({
        vehicles: [
          vehicle({ id: "a", make: "Toyota", saves: 6 }),
          vehicle({ id: "b", make: "Honda", saves: 1 }),
        ],
      })
    );
    expect(result.some((r) => r.title === "Buyers favour Toyota")).toBe(true);
  });

  it("orders actions before opportunities before info", () => {
    const result = buildRecommendations(
      input({
        pendingReviews: 2,
        vehicles: [vehicle({ views30d: 30, ageDays: 5 }), vehicle({ id: "v2", ageDays: 90 })],
      })
    );
    const severities = result.map((r) => r.severity);
    const sorted = [...severities].sort(
      (a, b) => ["action", "opportunity", "info"].indexOf(a) - ["action", "opportunity", "info"].indexOf(b)
    );
    expect(severities).toEqual(sorted);
  });
});
