import { extractJsonArray, parseDeals, scrubPublicText } from "./deals.parser";

const now = new Date("2026-09-21T10:00:00Z");

describe("scrubPublicText — nothing may reveal where a deal was found", () => {
  it("removes web addresses, emails and bare domains", () => {
    expect(scrubPublicText("Great price, see https://auction.example.com/lot/9 now")).toBe("Great price, see now");
    expect(scrubPublicText("Contact sales@dealer.co.za for details")).toBe("Contact for details");
    expect(scrubPublicText("Listed at autotrader.co.za/car/1 for less")).not.toMatch(/autotrader/);
    expect(scrubPublicText("Visit www.copart.com today")).toBe("Visit today");
  });

  it("removes 'according to …' style attributions", () => {
    expect(scrubPublicText("Clearance stock, according to Japan Used Cars, ends soon.")).not.toMatch(/Japan Used Cars/i);
    expect(scrubPublicText("Discount source: BeForward")).not.toMatch(/BeForward/);
  });

  it("leaves ordinary wording alone", () => {
    expect(scrubPublicText("Save 10% on a 2019 Toyota Hilux while stock lasts.")).toBe("Save 10% on a 2019 Toyota Hilux while stock lasts.");
  });
});

describe("extractJsonArray", () => {
  it("finds the list inside code fences and chatter", () => {
    expect(extractJsonArray('Here you go:\n```json\n[{"a":1}]\n```\nHope that helps')).toEqual([{ a: 1 }]);
  });
  it("returns null for garbage", () => {
    expect(extractJsonArray("no list here")).toBeNull();
    expect(extractJsonArray("[not json]")).toBeNull();
    expect(extractJsonArray('{"a":1}')).toBeNull();
  });
});

describe("parseDeals", () => {
  const good = { title: "Hilux clearance sale", summary: "Ten percent off selected double cabs while stock lasts.", priceUsd: 21500, vehicle: "Toyota Hilux 2019", validUntil: "2026-10-31", howToGet: "Call the exporter and ask for the October list." };

  it("keeps valid deals and shapes them", () => {
    const [deal] = parseDeals(JSON.stringify([good]), now);
    expect(deal).toMatchObject({ title: "Hilux clearance sale", priceUsd: 21500, vehicleLabel: "Toyota Hilux 2019", howToGet: "Call the exporter and ask for the October list." });
    expect(deal.validUntil?.toISOString()).toBe("2026-10-31T23:59:59.000Z");
  });

  it("scrubs sources from the public text but keeps staff instructions intact", () => {
    const [deal] = parseDeals(JSON.stringify([{ ...good, summary: "Ten percent off double cabs, see https://exporter.example/offer for more.", howToGet: "Email sales@exporter.example and mention offer 44." }]), now);
    expect(deal.summary).not.toMatch(/exporter/);
    expect(deal.howToGet).toContain("sales@exporter.example");
  });

  it("drops items missing a title or a usable summary, and non-objects", () => {
    const deals = parseDeals(JSON.stringify([{ title: "x", summary: "long enough summary text here" }, { title: "Real title here", summary: "short" }, "text", null, good]), now);
    expect(deals).toHaveLength(1);
  });

  it("ignores past dates and absurd prices instead of storing them", () => {
    const [deal] = parseDeals(JSON.stringify([{ ...good, validUntil: "2020-01-01", priceUsd: -5 }]), now);
    expect(deal.validUntil).toBeNull();
    expect(deal.priceUsd).toBeNull();
  });

  it("caps the number of deals", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...good, title: `Deal number ${i}` }));
    expect(parseDeals(JSON.stringify(many), now, 8)).toHaveLength(8);
  });

  it("returns nothing for an unreadable reply", () => {
    expect(parseDeals("Sorry, I couldn't find anything.", now)).toEqual([]);
  });
});
