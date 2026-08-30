import * as Astronomy from "astronomy-engine";
import { anyNaN, between } from "$lib";
import { getMoonEquatorialCoordinates, instantToDaysSinceJ2000 } from "$lib/soluna";

const { sin, cos, acos, PI } = Math;
const maxRa = 2 * PI;
const maxDec = PI / 2;

/**
 * Inputs are RADIANS, NOT HOURS OR DEGREES
 * @returns null if the coordinates are invalid, else the angular distance in radians
 */
export function angularDistance(ra1: number, dec1: number, ra2: number, dec2: number) {
	if (anyNaN(ra1, dec1, ra2, dec2)) return null;
	if (!between(ra1, 0, maxRa) || !between(ra2, 0, maxRa)) return null;
	if (!between(dec1, -maxDec, maxDec) || !between(dec2, -maxDec, maxDec)) return null;

	return acos(sin(dec1) * sin(dec2) + cos(dec1) * cos(dec2) * cos(ra1 - ra2));
}

export function angularDistanceToMoon(ra: number, dec: number, daysSinceJ2000TT: number) {
	const { rightAscension, declination } = getMoonEquatorialCoordinates(daysSinceJ2000TT);

	return angularDistance(ra, dec, rightAscension, declination);
}

export function raDecJ2000ToJNow(raHours: number, decDeg: number, instant: Temporal.Instant) {
	// We are given milliseconds since midnight of Jan 1, 1970 UTC
	// We want fractional days since J2000 UTC

	const time = Astronomy.MakeTime(instantToDaysSinceJ2000(instant));
	const rot = Astronomy.Rotation_EQJ_EQD(time);
	const vec = Astronomy.VectorFromSphere(new Astronomy.Spherical(decDeg, raHours * 15, 1), time);
	const rotated = Astronomy.RotateVector(rot, vec);
	return Astronomy.EquatorFromVector(rotated);
}
