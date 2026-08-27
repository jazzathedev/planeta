import { deg2rad, J2000, julianCorrection } from "../shared/constants.ts";
import { instantToDaysSinceJ2000, julianDayToInstant, toTerrestrialTime } from "../shared/time.ts";
import {
	altitudeFromHourAngle,
	greenwichMeanSiderealTime,
	normalizeAngleToPi,
} from "../shared/astro.ts";
import { getSunEquatorialCoordinates } from "./coordinates.ts";
import type { SunTimes } from "./types.ts";

const { PI, sin, cos, acos, sqrt, abs, round } = Math;

// Each row: [altitudeDeg, morningName, eveningName]
export const times: [number, string, string][] = [
	[-0.833, "sunrise", "sunset"],
	[-0.3, "sunriseEnd", "sunsetStart"],
	[-6, "dawn", "dusk"],
	[-12, "nauticalDawn", "nauticalDusk"],
	[-18, "astronomicalDawn", "astronomicalDusk"],
	[6, "goldenHourEnd", "goldenHour"],
];

export function addTime(altitudeDeg: number, riseName: string, setName: string): void {
	times.push([altitudeDeg, riseName, setName]);
}

function horizonDipCorrectionDeg(observerHeightMeters: number): number {
	return (-2.076 * sqrt(observerHeightMeters)) / 60;
}

function refineSolarTransit(approxTransitDaysUT: number, observerLongitudeWestRad: number): number {
	let transitDaysUT = approxTransitDaysUT;
	for (let i = 0; i < 3; i++) {
		const hourAngle = normalizeAngleToPi(
			greenwichMeanSiderealTime(transitDaysUT, observerLongitudeWestRad) -
				getSunEquatorialCoordinates(toTerrestrialTime(transitDaysUT)).rightAscension,
		);
		transitDaysUT -= hourAngle / (2 * PI);
	}
	return transitDaysUT;
}

function computeSunRiseSetJulianDays(
	targetAltitudeRad: number,
	transitDaysUT: number,
	riseSetSign: number,
	observerLongitudeWestRad: number,
	observerLatitudeRad: number,
	declinationAtTransitRad: number,
): number {
	const cosHourAngleAtAltitude =
		(sin(targetAltitudeRad) - sin(observerLatitudeRad) * sin(declinationAtTransitRad)) /
		(cos(observerLatitudeRad) * cos(declinationAtTransitRad));
	if (cosHourAngleAtAltitude < -1 || cosHourAngleAtAltitude > 1) return NaN;

	let approxDaysUT = transitDaysUT + (riseSetSign * acos(cosHourAngleAtAltitude)) / (2 * PI);
	for (let i = 0; i < 2; i++) {
		const sunEquatorial = getSunEquatorialCoordinates(toTerrestrialTime(approxDaysUT));
		const hourAngle = normalizeAngleToPi(
			greenwichMeanSiderealTime(approxDaysUT, observerLongitudeWestRad) -
				sunEquatorial.rightAscension,
		);
		const altitudeRad = altitudeFromHourAngle(
			hourAngle,
			observerLatitudeRad,
			sunEquatorial.declination,
		);
		const sineHourAngleFactor =
			cos(observerLatitudeRad) * cos(sunEquatorial.declination) * sin(hourAngle);
		if (abs(sineHourAngleFactor) < 1e-6) break;
		approxDaysUT += (altitudeRad - targetAltitudeRad) / (2 * PI * sineHourAngleFactor);
	}
	return approxDaysUT;
}

/**
 * Note: `night` is an alias for `astronomicalDusk`.
 * `nightEnd` is the *intuitive* contiguous-night end: next morning's dawn.
 * Use `astronomicalDawn` for the alternative definition
 */
export function getTimes(
	instant: Temporal.Instant,
	latitudeDeg: number,
	longitudeDeg: number,
	observerHeightMeters = 0,
): SunTimes {
	const observerLongitudeWestRad = deg2rad * -longitudeDeg;
	const observerLatitudeRad = deg2rad * latitudeDeg;
	const dipCorrectionDeg = horizonDipCorrectionDeg(observerHeightMeters);

	const approxSolarNoonOffsetDays = round(
		round(instantToDaysSinceJ2000(instant)) -
			julianCorrection -
			observerLongitudeWestRad / (2 * PI),
	);
	const transitDaysUT = refineSolarTransit(
		approxSolarNoonOffsetDays + julianCorrection + observerLongitudeWestRad / (2 * PI),
		observerLongitudeWestRad,
	);
	const declinationAtTransitRad = getSunEquatorialCoordinates(
		toTerrestrialTime(transitDaysUT),
	).declination;

	const result: SunTimes = {
		solarNoon: julianDayToInstant(transitDaysUT + J2000),
		nadir: julianDayToInstant(transitDaysUT + J2000 - 0.5),
		astronomicalDawn: null,
		astronomicalDusk: null,
		dawn: null,
		dusk: null,
		goldenHour: null,
		goldenHourEnd: null,
		nauticalDawn: null,
		nauticalDusk: null,
		neverUp: null,
		night: null,
		nightEnd: null,
		duration: null,
		sunrise: null,
		sunriseEnd: null,
		sunset: null,
		sunsetStart: null,
	} as unknown as SunTimes;

	for (const [altitudeDeg, riseName, setName] of times) {
		const targetAltitudeRad = (altitudeDeg + dipCorrectionDeg) * deg2rad;
		const riseDaysUT = computeSunRiseSetJulianDays(
			targetAltitudeRad,
			transitDaysUT,
			-1,
			observerLongitudeWestRad,
			observerLatitudeRad,
			declinationAtTransitRad,
		);
		const setDaysUT = computeSunRiseSetJulianDays(
			targetAltitudeRad,
			transitDaysUT,
			1,
			observerLongitudeWestRad,
			observerLatitudeRad,
			declinationAtTransitRad,
		);
		result[riseName] = Number.isNaN(riseDaysUT) ? null : julianDayToInstant(riseDaysUT + J2000);
		result[setName] = Number.isNaN(setDaysUT) ? null : julianDayToInstant(setDaysUT + J2000);
	}

	if (result.sunrise === null) {
		const noonAltitudeRad = altitudeFromHourAngle(0, observerLatitudeRad, declinationAtTransitRad);
		const thresholdAltitudeRad = (times[0][0] + dipCorrectionDeg) * deg2rad;
		result.alwaysUp = noonAltitudeRad > thresholdAltitudeRad;
		result.alwaysDown = noonAltitudeRad <= thresholdAltitudeRad;
	}

	result.night = result.astronomicalDusk;

	const astronomicalAltitudeRad = (-18 + dipCorrectionDeg) * deg2rad;
	const nextTransitDaysUT = refineSolarTransit(
		approxSolarNoonOffsetDays + 1 + julianCorrection + observerLongitudeWestRad / (2 * PI),
		observerLongitudeWestRad,
	);
	const nextDeclinationRad = getSunEquatorialCoordinates(
		toTerrestrialTime(nextTransitDaysUT),
	).declination;
	const nextDawnDaysUT = computeSunRiseSetJulianDays(
		astronomicalAltitudeRad,
		nextTransitDaysUT,
		-1,
		observerLongitudeWestRad,
		observerLatitudeRad,
		nextDeclinationRad,
	);
	result.nightEnd = Number.isNaN(nextDawnDaysUT)
		? null
		: julianDayToInstant(nextDawnDaysUT + J2000);

	if (result.night && result.nightEnd) result.duration = result.night.until(result.nightEnd);

	return result;
}
