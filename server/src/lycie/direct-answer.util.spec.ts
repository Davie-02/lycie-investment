import { directAnswer } from "./direct-answer.util";
import type { HireInfo, VehicleInfo } from "./prompt.builder";

const car = (slug: string, label: string, status = "available", bodyType = "Pickup"): VehicleInfo => ({
  slug, label, priceText: "USD 25,000 (≈ MWK 43,700,000)", mileageKm: 32000, fuelType: "Diesel", transmission: "Automatic", bodyType, status, location: "Lilongwe",
});
const vehicles = [car("hilux", "Toyota Hilux 2022"), car("fit", "Honda Fit 2020", "sold", "Hatchback"), car("corolla", "Toyota Corolla 2021", "available", "Sedan"), car("dmax", "Isuzu D-Max 2023", "reserved")];
const hire: HireInfo[] = [
  { name: "Toyota Hiace", dailyText: "USD 90 (≈ MWK 157,000)", weeklyText: "USD 540", seats: 14, transmission: "Manual", fuelType: "Diesel", available: true },
  { name: "Toyota Prado", dailyText: "USD 120", weeklyText: null, seats: 7, transmission: "Automatic", fuelType: "Diesel", available: false },
];

describe("directAnswer — answers stock, price and hire questions from live data", () => {
  it("answers 'do you have a Hilux?' with price and a vehicle card", () => {
    const answer = directAnswer("Do you have a Toyota Hilux?", vehicles, hire)!;
    expect(answer.slugs).toEqual(["hilux"]);
    expect(answer.text).toContain("USD 25,000 (≈ MWK 43,700,000)");
    expect(directAnswer("how much is the hilux", vehicles, hire)?.slugs).toEqual(["hilux"]);
  });

  it("matches by make and lists every available model of it", () => {
    const answer = directAnswer("Do you have any Toyota for sale?", vehicles, hire)!;
    expect(answer.slugs.sort()).toEqual(["corolla", "hilux"]);
  });

  it("says plainly when the vehicle is sold or reserved, and offers sourcing — no card", () => {
    const sold = directAnswer("Do you have a Honda Fit?", vehicles, hire)!;
    expect(sold.slugs).toEqual([]);
    expect(sold.text).toMatch(/sold/);
    expect(sold.text).toMatch(/source/i);
    expect(directAnswer("Is the Isuzu available?", vehicles, hire)?.text).toMatch(/reserved/);
  });

  it("lists what is available for hire, leaving out unavailable vehicles", () => {
    const answer = directAnswer("What vehicles can I hire?", vehicles, hire)!;
    expect(answer.text).toContain("Toyota Hiace");
    expect(answer.text).not.toContain("Prado");
    expect(answer.text).toContain("per week");
  });

  it("answers by body type", () => {
    expect(directAnswer("Do you have any sedans?", vehicles, hire)?.slugs).toEqual(["corolla"]);
  });

  it("shows what's in stock for a general 'what cars do you have?'", () => {
    const answer = directAnswer("What cars do you have?", vehicles, hire)!;
    expect(answer.slugs).toEqual(["hilux", "corolla"]);
  });

  it("leaves everything else to the AI — never guesses", () => {
    for (const q of [
      "Can I finance a Toyota Hilux?", // finance → complex
      "Do you import cars from Japan?", // import → complex
      "What is the best pickup for farming?", // opinion
      "Which car is cheapest?", // needs judgement
      "Do you have a Lamborghini?", // unknown vehicle, no generic word
      "How long does clearing take?",
      "hello",
      "Tell me about the company",
    ]) {
      expect(directAnswer(q, vehicles, hire)).toBeNull();
    }
  });

  it("returns nothing for very long or empty input", () => {
    expect(directAnswer("x".repeat(200), vehicles, hire)).toBeNull();
    expect(directAnswer("???", vehicles, hire)).toBeNull();
  });

  it("leaves 'Toyota Vitz' to the AI when we only stock other Toyotas", () => {
    expect(directAnswer("Do you have a Toyota Vitz?", vehicles, hire)).toBeNull();
  });
});
