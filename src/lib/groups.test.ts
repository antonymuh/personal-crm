import { describe, expect, it } from "vitest";

import {
  GROUP_NAME_REQUIRED,
  cleanGroupName,
  findSelectedGroup,
  parseGroupFilter,
  parseGroupIds,
  parseGroupName,
} from "@/lib/groups";

describe("parseGroupName", () => {
  it("rejects a name made of spaces", () => {
    expect(parseGroupName("   ")).toEqual({
      ok: false,
      error: "Укажите название группы",
    });
    expect(GROUP_NAME_REQUIRED).toBe("Укажите название группы");
  });

  it("rejects a missing name", () => {
    expect(parseGroupName(null)).toEqual({
      ok: false,
      error: GROUP_NAME_REQUIRED,
    });
  });

  it("trims spaces around the name", () => {
    expect(parseGroupName("  Теннис  ")).toEqual({ ok: true, name: "Теннис" });
  });
});

describe("cleanGroupName", () => {
  it("trims the name and treats an empty one as no name", () => {
    expect(cleanGroupName("  Теннис  ")).toBe("Теннис");
    expect(cleanGroupName("   ")).toBeNull();
    expect(cleanGroupName(null)).toBeNull();
  });
});

describe("parseGroupIds", () => {
  it("reads several checked groups", () => {
    expect(parseGroupIds(["3", "1"])).toEqual([3, 1]);
  });

  it("reads no checked groups", () => {
    expect(parseGroupIds([])).toEqual([]);
  });

  it("drops junk and repeats", () => {
    expect(
      parseGroupIds(["2", "abc", "", "-1", "0", "1.5", "2", " 4 "])
    ).toEqual([2]);
  });
});

describe("parseGroupFilter", () => {
  it("reads a group id from the address", () => {
    expect(parseGroupFilter("7")).toBe(7);
  });

  it("treats an empty or junk value as all contacts", () => {
    expect(parseGroupFilter(undefined)).toBeNull();
    expect(parseGroupFilter("")).toBeNull();
    expect(parseGroupFilter("tennis")).toBeNull();
    expect(parseGroupFilter("-3")).toBeNull();
    expect(parseGroupFilter("0")).toBeNull();
  });

  it("uses the first value when the parameter repeats", () => {
    expect(parseGroupFilter(["5", "6"])).toBe(5);
  });
});

describe("findSelectedGroup", () => {
  const groups = [
    { id: 1, name: "Семья" },
    { id: 2, name: "Теннис" },
  ];

  it("picks the group from the address", () => {
    expect(findSelectedGroup(groups, "2")).toEqual({ id: 2, name: "Теннис" });
  });

  it("falls back to all contacts when the group no longer exists", () => {
    expect(findSelectedGroup(groups, "9")).toBeNull();
  });

  it("selects all contacts without a filter", () => {
    expect(findSelectedGroup(groups, undefined)).toBeNull();
  });
});
