import { J1970, J2000, msInDay, msInHour } from "./constants.ts";

// Meeus Ch.7 Julian Day; J2000 = 2000-01-01 12:00 TT ≈ 11:58 UTC.
export function julianDayToInstant(julianDay: number): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(Math.round((julianDay + 0.5 - J1970) * msInDay));
}

export function instantToDaysSinceJ2000(instant: Temporal.Instant): number {
	return instant.epochMilliseconds / msInDay - 0.5 + J1970 - J2000;
}

export function instantPlusMs(instant: Temporal.Instant, ms: number): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(Math.round(instant.epochMilliseconds + ms));
}

export function instantPlusHours(instant: Temporal.Instant, hours: number): Temporal.Instant {
	return instantPlusMs(instant, hours * msInHour);
}

export function utcMidnight(instant: Temporal.Instant): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(
		Math.floor(instant.epochMilliseconds / msInDay) * msInDay,
	);
}

// ΔT = TT − UT in seconds. Espenak & Meeus polynomial fits, good ~1900-2150.
// Meeus position series are in Terrestrial Time; input Instants are UT.
// Ref: https://eclipse.gsfc.nasa.gov/LEcat5/deltatpoly.html
export function deltaTSeconds(daysSinceJ2000UT: number): number {
	const approxYear = 2000 + daysSinceJ2000UT / 365.2425;
	let offset: number;

	if (approxYear < 1920) {
		offset = approxYear - 1900;
		return (
			-2.79 + offset * (1.494119 + offset * (-0.0598939 + offset * (0.0061966 - offset * 0.000197)))
		);
	}
	if (approxYear < 1941) {
		offset = approxYear - 1920;
		return 21.2 + offset * (0.84493 + offset * (-0.0761 + offset * 0.0020936));
	}
	if (approxYear < 1961) {
		offset = approxYear - 1950;
		return 29.07 + offset * (0.407 + offset * (-1 / 233 + offset / 2547));
	}
	if (approxYear < 1986) {
		offset = approxYear - 1975;
		return 45.45 + offset * (1.067 + offset * (-1 / 260 - offset / 718));
	}
	if (approxYear < 2005) {
		offset = approxYear - 2000;
		return (
			63.86 +
			offset *
				(0.3345 +
					offset *
						(-0.060374 + offset * (0.0017275 + offset * (0.000651814 + offset * 0.00002373599))))
		);
	}
	if (approxYear < 2050) {
		offset = approxYear - 2000;
		return 62.92 + offset * (0.32217 + offset * 0.005589);
	}

	offset = (approxYear - 1820) / 100;
	return -20 + 32 * (offset ^ 2) - 0.5628 * (2150 - approxYear);
}

export function toTerrestrialTime(daysSinceJ2000UT: number): number {
	return daysSinceJ2000UT + deltaTSeconds(daysSinceJ2000UT) / (msInDay / 1000);
}
