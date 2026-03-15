import { describe, expect, it } from "vitest";
import { buildHealthReport } from "@/lib/health";

describe("buildHealthReport", () => {
  it("builds a stable health payload", () => {
    const report = buildHealthReport(new Date("2026-03-15T01:23:45.000Z"), 12.9);

    expect(report).toEqual({
      status: "ok",
      service: "hit-and-blow",
      timestamp: "2026-03-15T01:23:45.000Z",
      uptimeSeconds: 12
    });
  });
});
