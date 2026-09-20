import { describeAction, isLoggable } from "./describe-action";

describe("describeAction", () => {
  it("describes bulk content changes with the count", () => {
    expect(
      describeAction({ method: "POST", route: "/api/content-admin/:type/bulk", params: { type: "vehicles" }, body: { ids: ["a", "b", "c"], action: "archive" } })
    ).toBe("Archived 3 vehicles");
    expect(
      describeAction({ method: "POST", route: "/api/content-admin/:type/bulk", params: { type: "faq" }, body: { ids: ["a"], action: "publish" } })
    ).toBe("Published 1 FAQ");
  });

  it("describes ordinary CRUD by resource", () => {
    expect(describeAction({ method: "PATCH", route: "/api/vehicles/:id", params: {} })).toBe("Edited a vehicle");
    expect(describeAction({ method: "POST", route: "/api/notices", params: {} })).toBe("Added a notice");
  });

  it("never includes submitted text — only fixed wording and safe fields", () => {
    const text = describeAction({ method: "POST", route: "/api/contact-admin/:type/:id/email", params: {}, body: { subject: "secret", body: "0991 383 466" } });
    expect(text).toBe("Emailed a customer");
  });

  it("falls back to the route for anything unknown", () => {
    expect(describeAction({ method: "POST", route: "/api/something/new", params: {} })).toBe("POST /something/new");
  });
});

describe("isLoggable", () => {
  it("skips login flows and visitor traffic", () => {
    expect(isLoggable("/api/auth/login")).toBe(false);
    expect(isLoggable("/api/likes")).toBe(false);
    expect(isLoggable("/api/lycie/chat")).toBe(false);
    expect(isLoggable("/api/vehicles/:id")).toBe(true);
  });
});
