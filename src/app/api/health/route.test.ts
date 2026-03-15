import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns a successful no-store response", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("hit-and-blow");
    expect(typeof payload.timestamp).toBe("string");
    expect(typeof payload.uptimeSeconds).toBe("number");
  });
});
