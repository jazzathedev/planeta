export type CanonicalSunTimeName =
	| "sunrise"
	| "sunset"
	| "sunriseEnd"
	| "sunsetStart"
	| "dawn"
	| "dusk"
	| "nauticalDawn"
	| "nauticalDusk"
	| "astronomicalDawn"
	| "astronomicalDusk"
	| "goldenHourEnd"
	| "goldenHour";

export type SunTimeName = CanonicalSunTimeName | "night" | "nightEnd";

export type SunTimes = Record<CanonicalSunTimeName, Temporal.Instant | null> & {
	solarNoon: Temporal.Instant;
	nadir: Temporal.Instant;
	alwaysUp?: boolean;
	alwaysDown?: boolean;
	night: Temporal.Instant | null;
	nightEnd: Temporal.Instant | null;
	duration: Temporal.Duration | null;
	[custom: string]: Temporal.Instant | Temporal.Duration | boolean | null | undefined;
};
