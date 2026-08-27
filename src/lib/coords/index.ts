import { anyNaN, between } from "$lib";
import { getMoonEquatorialCoordinates } from "$lib/soluna";

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
