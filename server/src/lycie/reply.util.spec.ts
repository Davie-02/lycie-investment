import { parseReply } from "./reply.util";

const known = new Set(["toyota-hilux-2022", "honda-fit-2020"]);

describe("parseReply", () => {
  it("extracts known vehicle slugs and strips the markers", () => {
    const result = parseReply("Try this one [[vehicle:toyota-hilux-2022]] — great value.", known);
    expect(result.vehicleSlugs).toEqual(["toyota-hilux-2022"]);
    expect(result.text).toBe("Try this one — great value.");
  });

  it("drops slugs that are not in the real inventory", () => {
    const result = parseReply("See [[vehicle:made-up-car]] and [[vehicle:honda-fit-2020]]", known);
    expect(result.vehicleSlugs).toEqual(["honda-fit-2020"]);
    expect(result.text).not.toContain("[[");
  });

  it("de-duplicates and caps recommendations at three", () => {
    const many = new Set(["a", "b", "c", "d"]);
    const result = parseReply("[[vehicle:a]] [[vehicle:a]] [[vehicle:b]] [[vehicle:c]] [[vehicle:d]]", many);
    expect(result.vehicleSlugs).toEqual(["a", "b", "c"]);
  });

  it("detects and removes the no-info marker", () => {
    const result = parseReply("[[NO_INFO]] I don't have that detail — please contact our team.", known);
    expect(result.noInfo).toBe(true);
    expect(result.text).toBe("I don't have that detail — please contact our team.");
  });

  it("reports noInfo=false for a normal answer", () => {
    expect(parseReply("Importing usually takes about 6-8 weeks.", known).noInfo).toBe(false);
  });
});
