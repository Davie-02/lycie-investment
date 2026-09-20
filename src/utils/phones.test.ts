import { describe, expect, it } from "vitest";
import { splitPhones } from "./phones";

describe("splitPhones", () => {
  it("splits several numbers and builds tel links", () => {
    expect(splitPhones("+265 999 074 038 / +265 888 074 038")).toEqual([
      { label: "+265 999 074 038", href: "tel:+265999074038" },
      { label: "+265 888 074 038", href: "tel:+265888074038" },
    ]);
  });

  it("handles a single number and other separators", () => {
    expect(splitPhones("0991 383 466")).toEqual([{ label: "0991 383 466", href: "tel:0991383466" }]);
    expect(splitPhones("0991383466, 0881234567")).toHaveLength(2);
  });

  it("keeps non-numeric text without a link", () => {
    expect(splitPhones("Contact our team for current details")).toEqual([
      { label: "Contact our team for current details", href: null },
    ]);
  });
});
