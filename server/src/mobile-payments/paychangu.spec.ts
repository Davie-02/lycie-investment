import { interpretVerification } from "./paychangu.client";

describe("PayChangu verification", () => {
  it("only calls a payment successful when PayChangu says so", () => {
    expect(interpretVerification({ data: { status: "success", amount: 5000, currency: "MWK" } })).toMatchObject({ status: "success", amount: 5000, currency: "MWK" });
    expect(interpretVerification({ data: { status: "failed" } }).status).toBe("failed");
    expect(interpretVerification({ data: { status: "pending" } }).status).toBe("pending");
    expect(interpretVerification({}).status).toBe("pending");
  });
});
