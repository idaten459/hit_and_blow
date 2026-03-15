export interface HealthReport {
  status: "ok";
  service: "hit-and-blow";
  timestamp: string;
  uptimeSeconds: number;
}

export function buildHealthReport(
  now = new Date(),
  uptimeSeconds = process.uptime()
): HealthReport {
  return {
    status: "ok",
    service: "hit-and-blow",
    timestamp: now.toISOString(),
    uptimeSeconds: Math.floor(uptimeSeconds)
  };
}
