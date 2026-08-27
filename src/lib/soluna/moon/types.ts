import type { HorizontalPosition } from "../shared/types.ts";

export interface MoonPosition extends HorizontalPosition {
	distance: number;
	parallacticAngle: number;
}

export interface MoonIllumination {
	fraction: number;
	phase: number;
	angle: number;
	waxing: boolean;
}

export interface MoonTimes {
	rise?: Temporal.Instant;
	set?: Temporal.Instant;
	alwaysUp?: boolean;
	alwaysDown?: boolean;
}

export type MoonPhaseNames =
	| "New"
	| "Waxing crescent"
	| "First quarter"
	| "Waxing gibbous"
	| "Full"
	| "Last quarter"
	| "Waning gibbous"
	| "Waning crescent";
