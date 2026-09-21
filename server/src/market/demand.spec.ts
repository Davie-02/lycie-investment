import { WEIGHTS, adviceFor, buildDemand, type DemandInput } from "./demand";

const base: DemandInput = {
  vehicles: [
    { id: "v1", make: "Toyota", model: "Hilux", status: "available" },
    { id: "v2", make: "Honda", model: "Fit", status: "sold" },
  ],
  importRequests: [],
  inquiries: [],
  saves: [],
  likes: [],
  views: [],
};

describe("buildDemand", () => {
  it("weights buying signals above browsing signals", () => {
    const [row] = buildDemand({
      ...base,
      importRequests: [{ preferredMake: "Toyota", preferredModel: "Hilux" }],
      inquiries: [{ vehicleId: "v1" }],
      saves: [{ vehicleId: "v1" }],
      likes: [{ targetId: "v1" }],
      views: [{ vehicleId: "v1", views: 10 }],
    });
    expect(row.name).toBe("Toyota Hilux");
    expect(row.score).toBe(WEIGHTS.importRequests + WEIGHTS.inquiries + WEIGHTS.saves + WEIGHTS.likes + 10 * WEIGHTS.views);
    expect(row).toMatchObject({ importRequests: 1, inquiries: 1, saves: 1, likes: 1, views: 10 });
  });

  it("ranks the most-wanted first and ignores things nobody showed interest in", () => {
    const rows = buildDemand({ ...base, inquiries: [{ vehicleId: "v2" }, { vehicleId: "v2" }, { vehicleId: "v1" }] });
    expect(rows.map((r) => r.name)).toEqual(["Honda Fit", "Toyota Hilux"]);
    expect(buildDemand(base)).toEqual([]);
  });

  it("treats spelling and case variations of the same vehicle as one", () => {
    const rows = buildDemand({ ...base, importRequests: [{ preferredMake: " toyota ", preferredModel: "HILUX" }, { preferredMake: "Toyota", preferredModel: "hilux" }] });
    expect(rows).toHaveLength(1);
    expect(rows[0].importRequests).toBe(2);
  });

  it("counts only available vehicles as stock, and flags demand with none listed", () => {
    const [row] = buildDemand({ ...base, importRequests: [{ preferredMake: "Honda", preferredModel: "Fit" }] });
    expect(row.inStock).toBe(0); // the only Fit is sold
    expect(row.advice).toMatch(/none is listed/);
  });

  it("matches a make-only request to any model of that make", () => {
    const [row] = buildDemand({ ...base, importRequests: [{ preferredMake: "Toyota", preferredModel: null }] });
    expect(row.name).toBe("Toyota");
    expect(row.inStock).toBe(1);
  });

  it("limits the list", () => {
    const vehicles = Array.from({ length: 15 }, (_, i) => ({ id: `x${i}`, make: `Make${i}`, model: "M", status: "available" }));
    const inquiries = vehicles.map((v) => ({ vehicleId: v.id }));
    expect(buildDemand({ ...base, vehicles, inquiries }, 5)).toHaveLength(5);
  });
});

describe("adviceFor", () => {
  const row = { name: "x", importRequests: 0, inquiries: 0, saves: 0, likes: 0, views: 0, inStock: 1 };
  it("suggests fixing the listing when people look but never ask", () => {
    expect(adviceFor({ ...row, views: 100 })).toMatch(/price, photos/);
  });
  it("suggests promoting imports when several customers want it", () => {
    expect(adviceFor({ ...row, importRequests: 3 })).toMatch(/import/);
  });
});
