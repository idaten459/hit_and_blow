import { getDefaultSettings, validateSettings } from "./game/engine";
import type { GameMode, GameSettings } from "./game/types";

type SearchParamValue = string | string[] | undefined;

function readSingleValue(value: SearchParamValue): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function parseSettingsFromSearchParams(
  params: Record<string, SearchParamValue>,
  fallbackMode: GameMode
): GameSettings {
  const defaults = getDefaultSettings(fallbackMode);
  const parsed: GameSettings = {
    mode: (readSingleValue(params.mode) as GameMode | null) ?? fallbackMode,
    codeLength: Number.parseInt(readSingleValue(params.codeLength) ?? `${defaults.codeLength}`, 10),
    colorCount: Number.parseInt(readSingleValue(params.colorCount) ?? `${defaults.colorCount}`, 10),
    allowDuplicates: readSingleValue(params.allowDuplicates) === "true",
    turnLimit:
      readSingleValue(params.turnLimit) === "null"
        ? null
        : Number.parseInt(readSingleValue(params.turnLimit) ?? `${defaults.turnLimit}`, 10),
    assistEnabled: readSingleValue(params.assistEnabled) !== "false"
  };

  const validation = validateSettings(parsed);
  return validation.isValid ? parsed : defaults;
}

export function createSearchParams(settings: GameSettings): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("mode", settings.mode);
  searchParams.set("codeLength", `${settings.codeLength}`);
  searchParams.set("colorCount", `${settings.colorCount}`);
  searchParams.set("allowDuplicates", `${settings.allowDuplicates}`);
  searchParams.set("turnLimit", settings.turnLimit === null ? "null" : `${settings.turnLimit}`);
  searchParams.set("assistEnabled", `${settings.assistEnabled}`);

  return searchParams;
}
