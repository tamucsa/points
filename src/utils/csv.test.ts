import { describe, expect, it } from "vitest";
import { splitCsvLine } from "@/utils/csv";

describe("splitCsvLine", () => {
  it("splits a simple comma-separated row", () => {
    expect(splitCsvLine("Ada,ada@tamu.edu,2027")).toEqual([
      "Ada",
      "ada@tamu.edu",
      "2027",
    ]);
  });

  it("trims whitespace around unquoted fields", () => {
    expect(splitCsvLine(" Ada , ada@tamu.edu ")).toEqual([
      "Ada",
      "ada@tamu.edu",
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(splitCsvLine('"Li, Wei",wei@tamu.edu')).toEqual([
      "Li, Wei",
      "wei@tamu.edu",
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(splitCsvLine('"Wei ""The Intern"" Li",wei@tamu.edu')).toEqual([
      'Wei "The Intern" Li',
      "wei@tamu.edu",
    ]);
  });

  it("preserves empty fields", () => {
    expect(splitCsvLine("Ada,,2027")).toEqual(["Ada", "", "2027"]);
  });
});
