// Estimated values from telescopius and iTelescope.
// Using a lil bit of math where around 20 is the least separation recommended
// and each percent of illumination adds about 23 arcmin

import type { MoonPhaseNames } from "../moon";

export type FilterType = "HaSII" | "OIII" | "LRGB" | "OSC";
export type FilterName = "Ha / SII" | "OIII" | "LRGB" | "One-shot colour";
export type Verdict = "ok" | "close" | "bad";

const filterFactor: Record<FilterType, number> = { HaSII: 1, OIII: 1.5, LRGB: 2, OSC: 2.3 };

export function moonAvoidanceDeg(filter: FilterType, illumination: number): number {
	const i = Math.max(0, Math.min(1, illumination)) * 100;
	const ha = 19.954 + 0.3868 * i; // Ha/SII baseline
	return ha * filterFactor[filter];
}

export function recommendedAvoidanceDeg(illumination: number, types: FilterType[]): number {
	return Math.max(...types.map((t) => moonAvoidanceDeg(t, illumination)));
}

export function moonPhaseName(illumination: number, waxing: boolean): MoonPhaseNames {
	const percent = Math.max(0, Math.min(1, illumination)) * 100;

	if (percent < 3) return "New";
	if (percent > 97) return "Full";

	if (percent < 45) return waxing ? "Waxing crescent" : "Waning crescent";
	if (percent < 55) return waxing ? "First quarter" : "Last quarter";

	return waxing ? "Waxing gibbous" : "Waning gibbous";
}
