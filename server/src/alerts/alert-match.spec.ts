import { describeAlert, vehicleMatchesAlert } from "./alert-match";

const hilux = { make: "Toyota", model: "Hilux Double Cab", bodyType: "Pickup", year: 2019, price: 24000, currency: "USD" };

describe("vehicle alerts", () => {
  it("matches on make, loose model, body type, year and price", () => {
    expect(vehicleMatchesAlert(hilux, { make: "toyota", model: "hilux" })).toBe(true);
    expect(vehicleMatchesAlert(hilux, { bodyType: "pickups" })).toBe(true);
    expect(vehicleMatchesAlert(hilux, { make: "Nissan" })).toBe(false);
    expect(vehicleMatchesAlert(hilux, { minYear: 2020 })).toBe(false);
    expect(vehicleMatchesAlert(hilux, { maxPrice: 20000 })).toBe(false);
    expect(vehicleMatchesAlert(hilux, { maxPrice: 25000 })).toBe(true);
  });

  it("doesn't drop old kwacha listings just because there's no rate to compare", () => {
    expect(vehicleMatchesAlert({ ...hilux, price: 45_000_000, currency: "MWK" }, { maxPrice: 20000 })).toBe(true);
  });

  it("describes an alert in plain words", () => {
    expect(describeAlert({ make: "Toyota", model: "Hilux", minYear: 2018, maxPrice: 25000 })).toBe("Toyota Hilux, 2018 or newer, up to USD 25,000");
    expect(describeAlert({ bodyType: "SUV" })).toBe("Any SUV");
    expect(describeAlert({})).toBe("Any vehicle");
  });
});
