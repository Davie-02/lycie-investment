import { topicsForWrite } from "./topics";

describe("topicsForWrite", () => {
  it("maps content endpoints to their own topic", () => {
    expect(topicsForWrite("/api/vehicles/abc")).toEqual(["vehicles"]);
    expect(topicsForWrite("/api/site-content/hero")).toEqual(["site-content"]);
    expect(topicsForWrite("/api/site-content/language")).toEqual(["site-content"]);
    expect(topicsForWrite("/api/shipments/abc/progress")).toEqual(["shipments"]);
    expect(topicsForWrite("/api/faq")).toEqual(["faq"]);
  });

  it("uses the content type for bulk/duplicate/state changes", () => {
    expect(topicsForWrite("/api/content-admin/blog-posts/bulk")).toEqual(["blog-posts"]);
    expect(topicsForWrite("/api/content-admin/vehicles/x/duplicate")).toEqual(["vehicles"]);
  });

  it("bookings refresh hire availability", () => {
    expect(topicsForWrite("/api/hire-requests/1/status")).toEqual(["hire-vehicles"]);
  });

  it("publishing an AI FAQ draft refreshes the FAQ", () => {
    expect(topicsForWrite("/api/lycie/suggestions/1/publish")).toEqual(["faq"]);
  });

  it("ignores everything else", () => {
    expect(topicsForWrite("/api/auth/login")).toEqual([]);
    expect(topicsForWrite("/api/lycie/chat")).toEqual([]);
  });

  it("refreshes every price on open pages when the currency settings change", () => {
    expect(topicsForWrite("/api/pricing/settings")).toEqual(["pricing", "vehicles", "hire-vehicles"]);
  });

  it("refreshes the public deals when the deals desk publishes or removes one", () => {
    expect(topicsForWrite("/api/deal-admin/abc123/publish")).toEqual(["deals"]);
    expect(topicsForWrite("/api/deal-admin")).toEqual(["deals"]);
  });
});
