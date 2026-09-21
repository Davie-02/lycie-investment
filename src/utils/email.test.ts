import { describe, expect, it } from "vitest";
import { emailError, isValidEmailFormat, suggestEmailFix } from "./email";

describe("isValidEmailFormat", () => {
  it("accepts ordinary addresses", () => {
    for (const email of ["a@b.co", "first.last@example.com", "name+tag@sub.example.org", "x_y-z@my-domain.mw"]) {
      expect(isValidEmailFormat(email)).toBe(true);
    }
  });

  it("rejects malformed addresses", () => {
    for (const email of ["", "plain", "a@b", "a@@b.com", "a b@c.com", "a@b..com", ".a@b.com", "a.@b.com", "a@-b.com", "a@b.c"]) {
      expect(isValidEmailFormat(email)).toBe(false);
    }
  });
});

describe("suggestEmailFix", () => {
  it("corrects typos of common providers", () => {
    expect(suggestEmailFix("jane@gmial.com")).toBe("jane@gmail.com");
    expect(suggestEmailFix("jane@gmail.con")).toBe("jane@gmail.com");
    expect(suggestEmailFix("jane@yaho.com")).toBe("jane@yahoo.com");
    expect(suggestEmailFix("jane@hotmial.com")).toBe("jane@hotmail.com");
  });

  it("leaves correct and unrelated domains alone", () => {
    expect(suggestEmailFix("jane@gmail.com")).toBeNull();
    expect(suggestEmailFix("jane@lycieinvestments.com")).toBeNull();
    expect(suggestEmailFix("not an email")).toBeNull();
  });
});

describe("emailError", () => {
  it("returns a message for empty and invalid input, null for valid", () => {
    expect(emailError("")).toMatch(/required/i);
    expect(emailError("nope")).toMatch(/valid email/i);
    expect(emailError("ok@example.com")).toBeNull();
  });
});
