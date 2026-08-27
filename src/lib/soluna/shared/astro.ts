import { deg2rad } from "./constants.ts";

const { PI, sin, cos, tan, asin, atan2, round } = Math;

// Meeus Ch.13-14. Angles in radians unless suffixed Deg.
export function azimuthFromHourAngle(
	hourAngle: number,
	observerLatitudeRad: number,
	declinationRad: number,
): number {
	return (
		(atan2(
			sin(hourAngle),
			cos(hourAngle) * sin(observerLatitudeRad) - tan(declinationRad) * cos(observerLatitudeRad),
		) /
			deg2rad +
			540) %
		360
	);
}

export function altitudeFromHourAngle(
	hourAngle: number,
	observerLatitudeRad: number,
	declinationRad: number,
): number {
	return asin(
		sin(observerLatitudeRad) * sin(declinationRad) +
			cos(observerLatitudeRad) * cos(declinationRad) * cos(hourAngle),
	);
}

// Meeus 12.4 — Greenwich mean sidereal time (linear term, sub-arcsec T² dropped)
export function greenwichMeanSiderealTime(
	daysSinceJ2000UT: number,
	observerLongitudeWestRad: number,
): number {
	return deg2rad * (280.46061837 + 360.98564736629 * daysSinceJ2000UT) - observerLongitudeWestRad;
}

// Meeus 16.4 — Bennett refraction, folded to radians: 1.02 / tan(h + 10.26/(h+5.10)) arcmin
export function atmosphericRefractionRad(correctedAltitudeRad: number): number {
	let altitudeRad = correctedAltitudeRad;
	if (altitudeRad < 0) altitudeRad = 0;
	return 0.0002967 / tan(altitudeRad + 0.00312536 / (altitudeRad + 0.08901179));
}

export function normalizeAngleToPi(angleRad: number): number {
	return angleRad - 2 * PI * round(angleRad / (2 * PI));
}
