import { redactPii } from "./pii.util";

describe("redactPii", () => {
  it("removes email addresses", () => {
    expect(redactPii("write to john.phiri@example.com please")).toBe("write to [email] please");
  });

  it("removes international and local phone numbers", () => {
    expect(redactPii("call +265 991 383 466")).toBe("call [phone]");
    expect(redactPii("call +265-99-138-3466 now")).toBe("call [phone] now");
    expect(redactPii("my number is 0991 383 466")).toBe("my number is [phone]");
    expect(redactPii("or 0881234567")).toBe("or [phone]");
  });

  it("removes long numeric identifiers", () => {
    expect(redactPii("card 4111111111111111")).toBe("card [number]");
  });

  it("does NOT mistake prices or years for personal data", () => {
    const text = "Is the 2020 Honda Fit at 12,800,000 or 12800000 MWK still available?";
    expect(redactPii(text)).toBe(text);
  });

  it("redacts a name introduced with a cue phrase", () => {
    expect(redactPii("Hi, my name is Chikondi Banda and I want a Hilux")).toBe(
      "Hi, my name is [name] and I want a Hilux"
    );
  });

  it("leaves ordinary text untouched", () => {
    const text = "How long does importing from Japan take?";
    expect(redactPii(text)).toBe(text);
  });
});
