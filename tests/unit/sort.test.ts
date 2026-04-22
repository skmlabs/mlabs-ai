import { describe, it, expect } from "vitest";

type Row = { title: string; calls: number; rating: number | null };
function sortRows(rows: Row[], key: keyof Row, dir: "asc" | "desc"): Row[] {
  const r = [...rows];
  r.sort((a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (typeof av === "string" && typeof bv === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  return r;
}

describe("sortRows", () => {
  const rows: Row[] = [
    { title: "Beta", calls: 5, rating: 4 },
    { title: "Alpha", calls: 10, rating: null },
    { title: "Charlie", calls: 2, rating: 5 },
  ];
  it("sorts by string asc", () => {
    expect(sortRows(rows, "title", "asc").map(r => r.title)).toEqual(["Alpha", "Beta", "Charlie"]);
  });
  it("sorts by number desc", () => {
    expect(sortRows(rows, "calls", "desc").map(r => r.title)).toEqual(["Alpha", "Beta", "Charlie"]);
  });
  it("treats null as 0 in numeric sort", () => {
    const r = sortRows(rows, "rating", "desc");
    expect(r[0]!.title).toBe("Charlie");
    expect(r[r.length - 1]!.title).toBe("Alpha");
  });
});
