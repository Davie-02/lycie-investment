import { csvCell, toCsv } from "./csv.util";

describe("csvCell", () => {
  it("quotes values with commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
  });

  it("leaves phone numbers and plain numbers alone", () => {
    expect(csvCell("+265 991 383 466")).toBe("+265 991 383 466");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell("+1+1")).toBe("'+1+1");
  });

  it("handles empty values and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(new Date("2026-09-20T10:00:00Z"))).toBe("2026-09-20T10:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("builds header + rows with CRLF endings", () => {
    expect(toCsv(["Name", "Phone"], [["Grace", "0991"]])).toBe("Name,Phone\r\nGrace,0991\r\n");
  });
});
