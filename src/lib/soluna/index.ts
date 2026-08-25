const { PI, sin, cos, tan, asin, atan2, acos, sqrt, abs, round } = Math;

const deg2rad = PI / 180;

const msInDay = 86_400_000;
const msInHour = 3_600_000;
const J1970 = 2440588;
const J2000 = 2451545;
const earthRadiusKm = 6378.14;
const sunDistanceKm = 149_598_000;
const julianCorrection = 0.0009;

// All angles in degrees. Azimuth: 0 = N, 90 = E, 180 = S, 270 = W, clockwise.
export interface HorizontalPosition {
	azimuth: number;
	altitude: number;
}

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

// Meeus Ch.7 Julian Day; J2000 = 2000-01-01 12:00 TT ≈ 11:58 UTC.
function julianDayToInstant(julianDay: number): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(Math.round((julianDay + 0.5 - J1970) * msInDay));
}

function instantToDaysSinceJ2000(instant: Temporal.Instant): number {
	return instant.epochMilliseconds / msInDay - 0.5 + J1970 - J2000;
}

function instantPlusMs(instant: Temporal.Instant, ms: number): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(Math.round(instant.epochMilliseconds + ms));
}

function instantPlusHours(instant: Temporal.Instant, hours: number): Temporal.Instant {
	return instantPlusMs(instant, hours * msInHour);
}

function utcMidnight(instant: Temporal.Instant): Temporal.Instant {
	return Temporal.Instant.fromEpochMilliseconds(
		Math.floor(instant.epochMilliseconds / msInDay) * msInDay,
	);
}

// ΔT = TT − UT in seconds. Espenak & Meeus polynomial fits, good ~1900-2150.
// Meeus position series are in Terrestrial Time; input Instants are UT.
// Ref: https://eclipse.gsfc.nasa.gov/LEcat5/deltatpoly.html
function deltaTSeconds(daysSinceJ2000UT: number): number {
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

function toTerrestrialTime(daysSinceJ2000UT: number): number {
	return daysSinceJ2000UT + deltaTSeconds(daysSinceJ2000UT) / (msInDay / 1000);
}

// Meeus Ch.13-14. Angles in radians unless suffixed Deg.
function azimuthFromHourAngle(
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

function altitudeFromHourAngle(
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
function greenwichMeanSiderealTime(
	daysSinceJ2000UT: number,
	observerLongitudeWestRad: number,
): number {
	return deg2rad * (280.46061837 + 360.98564736629 * daysSinceJ2000UT) - observerLongitudeWestRad;
}

// Meeus 16.4 — Bennett refraction, folded to radians: 1.02 / tan(h + 10.26/(h+5.10)) arcmin
function atmosphericRefractionRad(correctedAltitudeRad: number): number {
	let altitudeRad = correctedAltitudeRad;
	if (altitudeRad < 0) altitudeRad = 0;
	return 0.0002967 / tan(altitudeRad + 0.00312536 / (altitudeRad + 0.08901179));
}

interface EquatorialCoordinates {
	// radians!!!
	rightAscension: number;
	// me too!
	declination: number;
}

function getSunEquatorialCoordinates(daysSinceJ2000TT: number): EquatorialCoordinates {
	const julianCenturiesTT = daysSinceJ2000TT / 36525;

	const geometricMeanLongitudeRad =
		deg2rad * (280.46646 + julianCenturiesTT * (36000.76983 + julianCenturiesTT * 0.0003032));
	const meanAnomalyRad =
		deg2rad * (357.52911 + julianCenturiesTT * (35999.05029 - julianCenturiesTT * 0.0001537));

	const sinMeanAnomaly = sin(meanAnomalyRad);
	const cosMeanAnomaly = cos(meanAnomalyRad);

	const equationOfCenterRad =
		deg2rad *
		((1.914602 - julianCenturiesTT * (0.004817 + julianCenturiesTT * 0.000014)) * sinMeanAnomaly +
			(0.019993 - 0.000101 * julianCenturiesTT) * 2 * sinMeanAnomaly * cosMeanAnomaly +
			0.000289 * sinMeanAnomaly * (3 - 4 * sinMeanAnomaly * sinMeanAnomaly));

	const lunarAscendingNodeLongitudeRad = deg2rad * (125.04 - 1934.136 * julianCenturiesTT);
	// nutation + aberration
	const apparentEclipticLongitudeRad =
		geometricMeanLongitudeRad +
		equationOfCenterRad -
		deg2rad * (0.00569 + 0.00478 * sin(lunarAscendingNodeLongitudeRad));

	const trueObliquityRad =
		deg2rad *
			(23.439291 -
				julianCenturiesTT *
					(0.0130042 + julianCenturiesTT * (0.00000016 - julianCenturiesTT * 0.000000504))) +
		deg2rad * 0.00256 * cos(lunarAscendingNodeLongitudeRad);

	return {
		rightAscension: atan2(
			cos(trueObliquityRad) * sin(apparentEclipticLongitudeRad),
			cos(apparentEclipticLongitudeRad),
		),
		declination: asin(sin(trueObliquityRad) * sin(apparentEclipticLongitudeRad)),
	};
}

export function getPosition(
	instant: Temporal.Instant,
	latitudeDeg: number,
	longitudeDeg: number,
): HorizontalPosition {
	const observerLongitudeWestRad = deg2rad * -longitudeDeg;
	const observerLatitudeRad = deg2rad * latitudeDeg;
	const daysSinceJ2000UT = instantToDaysSinceJ2000(instant);

	const sunEquatorial = getSunEquatorialCoordinates(toTerrestrialTime(daysSinceJ2000UT));
	const localHourAngle =
		greenwichMeanSiderealTime(daysSinceJ2000UT, observerLongitudeWestRad) -
		sunEquatorial.rightAscension;
	const geometricAltitudeRad = altitudeFromHourAngle(
		localHourAngle,
		observerLatitudeRad,
		sunEquatorial.declination,
	);

	return {
		azimuth: azimuthFromHourAngle(localHourAngle, observerLatitudeRad, sunEquatorial.declination),
		altitude: (geometricAltitudeRad + atmosphericRefractionRad(geometricAltitudeRad)) / deg2rad,
	};
}

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

function normalizeAngleToPi(angleRad: number): number {
	return angleRad - 2 * PI * round(angleRad / (2 * PI));
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
	};

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

function getNutationAndObliquity(julianCenturiesTT: number): {
	nutationInLongitudeDeg: number;
	trueObliquityRad: number;
} {
	const lunarNodeLongitudeRad = deg2rad * (125.04452 - 1934.136261 * julianCenturiesTT);
	const solarMeanLongitudeRad = deg2rad * (280.4665 + 36000.7698 * julianCenturiesTT);
	const lunarMeanLongitudeRad = deg2rad * (218.3165 + 481267.8813 * julianCenturiesTT);
	const nutationInLongitudeDeg =
		(-17.2 * sin(lunarNodeLongitudeRad) -
			1.32 * sin(2 * solarMeanLongitudeRad) -
			0.23 * sin(2 * lunarMeanLongitudeRad) +
			0.21 * sin(2 * lunarNodeLongitudeRad)) /
		3600;
	const nutationInObliquityDeg =
		(9.2 * cos(lunarNodeLongitudeRad) +
			0.57 * cos(2 * solarMeanLongitudeRad) +
			0.1 * cos(2 * lunarMeanLongitudeRad) -
			0.09 * cos(2 * lunarNodeLongitudeRad)) /
		3600;
	const meanObliquityDeg =
		23.439291 -
		julianCenturiesTT *
			(0.0130042 + julianCenturiesTT * (0.00000016 - julianCenturiesTT * 0.000000504)); // 22.2
	return {
		nutationInLongitudeDeg,
		trueObliquityRad: deg2rad * (meanObliquityDeg + nutationInObliquityDeg),
	};
}

// Table 47.A — longitude (×1e-6 deg) & distance (×1e-3 km). Rows: D,M,M',F, Σl, Σr
const MOON_LON_TABLE = new Int32Array([
	0, 0, 1, 0, 6288774, -20905355, 2, 0, -1, 0, 1274027, -3699111, 2, 0, 0, 0, 658314, -2955968, 0,
	0, 2, 0, 213618, -569925, 0, 1, 0, 0, -185116, 48888, 0, 0, 0, 2, -114332, -3149, 2, 0, -2, 0,
	58793, 246158, 2, -1, -1, 0, 57066, -152138, 2, 0, 1, 0, 53322, -170733, 2, -1, 0, 0, 45758,
	-204586, 0, 1, -1, 0, -40923, -129620, 1, 0, 0, 0, -34720, 108743, 0, 1, 1, 0, -30383, 104755, 2,
	0, 0, -2, 15327, 10321, 0, 0, 1, 2, -12528, 0, 0, 0, 1, -2, 10980, 79661, 4, 0, -1, 0, 10675,
	-34782, 0, 0, 3, 0, 10034, -23210, 4, 0, -2, 0, 8548, -21636, 2, 1, -1, 0, -7888, 24208, 2, 1, 0,
	0, -6766, 30824, 1, 0, -1, 0, -5163, -8379, 1, 1, 0, 0, 4987, -16675, 2, -1, 1, 0, 4036, -12831,
	2, 0, 2, 0, 3994, -10445, 4, 0, 0, 0, 3861, -11650, 2, 0, -3, 0, 3665, 14403, 0, 1, -2, 0, -2689,
	-7003, 2, 0, -1, 2, -2602, 0, 2, -1, -2, 0, 2390, 10056, 1, 0, 1, 0, -2348, 6322, 2, -2, 0, 0,
	2236, -9884, 0, 1, 2, 0, -2120, 5751, 0, 2, 0, 0, -2069, 0, 2, -2, -1, 0, 2048, -4950, 2, 0, 1,
	-2, -1773, 4130, 2, 0, 0, 2, -1595, 0, 4, -1, -1, 0, 1215, -3958, 0, 0, 2, 2, -1110, 0, 3, 0, -1,
	0, -892, 3258, 2, 1, 1, 0, -810, 2616, 4, -1, -2, 0, 759, -1897, 0, 2, -1, 0, -713, -2117, 2, 2,
	-1, 0, -700, 2354, 2, 1, -2, 0, 691, 0, 2, -1, 0, -2, 596, 0, 4, 0, 1, 0, 549, -1423, 0, 0, 4, 0,
	537, -1117, 4, -1, 0, 0, 520, -1571, 1, 0, -2, 0, -487, -1739, 2, 1, 0, -2, -399, 0, 0, 0, 2, -2,
	-381, -4421, 1, 1, 1, 0, 351, 0, 3, 0, -2, 0, -340, 0, 4, 0, -3, 0, 330, 0, 2, -1, 2, 0, 327, 0,
	0, 2, 1, 0, -323, 1165, 1, 1, -1, 0, 299, 0, 2, 0, 3, 0, 294, 0, 2, 0, -1, -2, 0, 8752,
]);

// Table 47.B — latitude (×1e-6 deg). Rows: D,M,M',F, Σb
const MOON_LAT_TABLE = new Int32Array([
	0, 0, 0, 1, 5128122, 0, 0, 1, 1, 280602, 0, 0, 1, -1, 277693, 2, 0, 0, -1, 173237, 2, 0, -1, 1,
	55413, 2, 0, -1, -1, 46271, 2, 0, 0, 1, 32573, 0, 0, 2, 1, 17198, 2, 0, 1, -1, 9266, 0, 0, 2, -1,
	8822, 2, -1, 0, -1, 8216, 2, 0, -2, -1, 4324, 2, 0, 1, 1, 4200, 2, 1, 0, -1, -3359, 2, -1, -1, 1,
	2463, 2, -1, 0, 1, 2211, 2, -1, -1, -1, 2065, 0, 1, -1, -1, -1870, 4, 0, -1, -1, 1828, 0, 1, 0, 1,
	-1794, 0, 0, 0, 3, -1749, 0, 1, -1, 1, -1565, 1, 0, 0, 1, -1491, 0, 1, 1, 1, -1475, 0, 1, 1, -1,
	-1410, 0, 1, 0, -1, -1344, 1, 0, 0, -1, -1335, 0, 0, 3, 1, 1107, 4, 0, 0, -1, 1021, 4, 0, -1, 1,
	833, 0, 0, 1, -3, 777, 4, 0, -2, 1, 671, 2, 0, 0, -3, 607, 2, 0, 2, -1, 596, 2, -1, 1, -1, 491, 2,
	0, -2, 1, -451, 0, 0, 3, -1, 439, 2, 0, 2, 1, 422, 2, 0, -3, -1, 421, 2, 1, -1, 1, -366, 2, 1, 0,
	1, -351, 4, 0, 0, 1, 331, 2, -1, 1, 1, 315, 2, -2, 0, -1, 302, 0, 0, 1, 3, -283, 2, 1, 1, -1,
	-229, 1, 1, 0, -1, 223, 1, 1, 0, 1, 223, 0, 1, -2, -1, -220, 2, 1, -1, -1, -220, 1, 0, 1, 1, -185,
	2, -1, -2, -1, 181, 0, 1, 2, 1, -177, 4, 0, -2, -1, 176, 4, -1, -1, -1, 166, 1, 0, 1, -1, -164, 4,
	0, 1, -1, 132, 1, 0, -1, -1, -119, 4, -1, 0, -1, 115, 2, -2, 0, 1, 107,
]);

function getMoonEquatorialCoordinates(
	daysSinceJ2000TT: number,
): EquatorialCoordinates & { distanceKm: number } {
	const julianCenturiesTT = daysSinceJ2000TT / 36525;

	const meanLongitudeMoonDeg =
		218.3164477 +
		julianCenturiesTT *
			(481267.88123421 +
				julianCenturiesTT *
					(-0.0015786 + julianCenturiesTT * (1 / 538841 - julianCenturiesTT / 65194000)));
	const meanElongationDeg =
		297.8501921 +
		julianCenturiesTT *
			(445267.1114034 +
				julianCenturiesTT *
					(-0.0018819 + julianCenturiesTT * (1 / 545868 - julianCenturiesTT / 113065000)));
	const sunMeanAnomalyDeg =
		357.5291092 +
		julianCenturiesTT *
			(35999.0502909 + julianCenturiesTT * (-0.0001536 + julianCenturiesTT / 24490000));
	const moonMeanAnomalyDeg =
		134.9633964 +
		julianCenturiesTT *
			(477198.8675055 +
				julianCenturiesTT *
					(0.0087414 + julianCenturiesTT * (1 / 69699 - julianCenturiesTT / 14712000)));
	const moonArgumentOfLatitudeDeg =
		93.272095 +
		julianCenturiesTT *
			(483202.0175233 +
				julianCenturiesTT *
					(-0.0036539 + julianCenturiesTT * (-1 / 3526000 + julianCenturiesTT / 863310000)));
	const additionalArg1Deg = 119.75 + 131.849 * julianCenturiesTT;
	const additionalArg2Deg = 53.09 + 479264.29 * julianCenturiesTT;
	const additionalArg3Deg = 313.45 + 481266.484 * julianCenturiesTT;
	const earthEccentricityFactor =
		1 - julianCenturiesTT * (0.002516 + julianCenturiesTT * 0.0000074);

	const meanElongationRad = deg2rad * meanElongationDeg;
	const sunMeanAnomalyRad = deg2rad * sunMeanAnomalyDeg;
	const moonMeanAnomalyRad = deg2rad * moonMeanAnomalyDeg;
	const moonArgumentOfLatitudeRad = deg2rad * moonArgumentOfLatitudeDeg;

	let sumLongitudeMicroDeg = 0;
	let sumDistanceMeters = 0;
	let sumLatitudeMicroDeg = 0;

	for (let i = 0; i < MOON_LON_TABLE.length; i += 6) {
		const sunAnomalyMultiplier = MOON_LON_TABLE[i + 1];
		const phaseArgumentRad =
			MOON_LON_TABLE[i] * meanElongationRad +
			sunAnomalyMultiplier * sunMeanAnomalyRad +
			MOON_LON_TABLE[i + 2] * moonMeanAnomalyRad +
			MOON_LON_TABLE[i + 3] * moonArgumentOfLatitudeRad;
		const eccentricityFactor =
			sunAnomalyMultiplier === 1 || sunAnomalyMultiplier === -1
				? earthEccentricityFactor
				: sunAnomalyMultiplier === 2 || sunAnomalyMultiplier === -2
					? earthEccentricityFactor * earthEccentricityFactor
					: 1;
		sumLongitudeMicroDeg += MOON_LON_TABLE[i + 4] * eccentricityFactor * sin(phaseArgumentRad);
		sumDistanceMeters += MOON_LON_TABLE[i + 5] * eccentricityFactor * cos(phaseArgumentRad);
	}
	for (let i = 0; i < MOON_LAT_TABLE.length; i += 5) {
		const sunAnomalyMultiplier = MOON_LAT_TABLE[i + 1];
		const phaseArgumentRad =
			MOON_LAT_TABLE[i] * meanElongationRad +
			sunAnomalyMultiplier * sunMeanAnomalyRad +
			MOON_LAT_TABLE[i + 2] * moonMeanAnomalyRad +
			MOON_LAT_TABLE[i + 3] * moonArgumentOfLatitudeRad;
		const eccentricityFactor =
			sunAnomalyMultiplier === 1 || sunAnomalyMultiplier === -1
				? earthEccentricityFactor
				: sunAnomalyMultiplier === 2 || sunAnomalyMultiplier === -2
					? earthEccentricityFactor * earthEccentricityFactor
					: 1;
		sumLatitudeMicroDeg += MOON_LAT_TABLE[i + 4] * eccentricityFactor * sin(phaseArgumentRad);
	}

	const additionalArg1Rad = deg2rad * additionalArg1Deg;
	const meanLongitudeMoonRad = deg2rad * meanLongitudeMoonDeg;
	sumLongitudeMicroDeg +=
		3958 * sin(additionalArg1Rad) +
		1962 * sin(meanLongitudeMoonRad - moonArgumentOfLatitudeRad) +
		318 * sin(deg2rad * additionalArg2Deg);
	sumLatitudeMicroDeg +=
		-2235 * sin(meanLongitudeMoonRad) +
		382 * sin(deg2rad * additionalArg3Deg) +
		175 * sin(additionalArg1Rad - moonArgumentOfLatitudeRad) +
		175 * sin(additionalArg1Rad + moonArgumentOfLatitudeRad) +
		127 * sin(meanLongitudeMoonRad - moonMeanAnomalyRad) -
		115 * sin(meanLongitudeMoonRad + moonMeanAnomalyRad);

	const { nutationInLongitudeDeg, trueObliquityRad } = getNutationAndObliquity(julianCenturiesTT);
	const apparentEclipticLongitudeRad =
		deg2rad * (meanLongitudeMoonDeg + sumLongitudeMicroDeg / 1e6 + nutationInLongitudeDeg);
	const eclipticLatitudeRad = deg2rad * (sumLatitudeMicroDeg / 1e6);

	return {
		rightAscension: atan2(
			sin(apparentEclipticLongitudeRad) * cos(trueObliquityRad) -
				tan(eclipticLatitudeRad) * sin(trueObliquityRad),
			cos(apparentEclipticLongitudeRad),
		),
		declination: asin(
			sin(eclipticLatitudeRad) * cos(trueObliquityRad) +
				cos(eclipticLatitudeRad) * sin(trueObliquityRad) * sin(apparentEclipticLongitudeRad),
		),
		distanceKm: 385000.56 + sumDistanceMeters / 1000,
	};
}

export function getMoonPosition(
	instant: Temporal.Instant,
	latitudeDeg: number,
	longitudeDeg: number,
): MoonPosition {
	const observerLongitudeWestRad = deg2rad * -longitudeDeg;
	const observerLatitudeRad = deg2rad * latitudeDeg;
	const daysSinceJ2000UT = instantToDaysSinceJ2000(instant);
	const moonEquatorial = getMoonEquatorialCoordinates(toTerrestrialTime(daysSinceJ2000UT));
	const localHourAngle =
		greenwichMeanSiderealTime(daysSinceJ2000UT, observerLongitudeWestRad) -
		moonEquatorial.rightAscension;

	const geocentricAltitudeRad = altitudeFromHourAngle(
		localHourAngle,
		observerLatitudeRad,
		moonEquatorial.declination,
	);
	// Meeus Ch.40 parallax
	const topocentricAltitudeRad =
		geocentricAltitudeRad -
		asin((earthRadiusKm / moonEquatorial.distanceKm) * cos(geocentricAltitudeRad));

	const parallacticAngleRad = atan2(
		sin(localHourAngle),
		tan(observerLatitudeRad) * cos(moonEquatorial.declination) -
			sin(moonEquatorial.declination) * cos(localHourAngle),
	);

	return {
		azimuth: azimuthFromHourAngle(localHourAngle, observerLatitudeRad, moonEquatorial.declination),
		altitude: (topocentricAltitudeRad + atmosphericRefractionRad(topocentricAltitudeRad)) / deg2rad,
		distance: moonEquatorial.distanceKm,
		parallacticAngle: parallacticAngleRad / deg2rad,
	};
}

// Meeus Ch.48 + idlastro mphase.pro — illuminated fraction / phase / bright-limb angle
export function getMoonIllumination(
	instant: Temporal.Instant = Temporal.Now.instant(),
): MoonIllumination {
	const daysSinceJ2000TT = toTerrestrialTime(instantToDaysSinceJ2000(instant));
	const sunEquatorial = getSunEquatorialCoordinates(daysSinceJ2000TT);
	const moonEquatorial = getMoonEquatorialCoordinates(daysSinceJ2000TT);

	const elongationRad = acos(
		sin(sunEquatorial.declination) * sin(moonEquatorial.declination) +
			cos(sunEquatorial.declination) *
				cos(moonEquatorial.declination) *
				cos(sunEquatorial.rightAscension - moonEquatorial.rightAscension),
	);
	const phaseAngleRad = atan2(
		sunDistanceKm * sin(elongationRad),
		moonEquatorial.distanceKm - sunDistanceKm * cos(elongationRad),
	);
	const positionAngleRad = atan2(
		cos(sunEquatorial.declination) *
			sin(sunEquatorial.rightAscension - moonEquatorial.rightAscension),
		sin(sunEquatorial.declination) * cos(moonEquatorial.declination) -
			cos(sunEquatorial.declination) *
				sin(moonEquatorial.declination) *
				cos(sunEquatorial.rightAscension - moonEquatorial.rightAscension),
	);

	const isWaxing = positionAngleRad < 0;

	return {
		fraction: (1 + cos(phaseAngleRad)) / 2,
		phase: 0.5 + (0.5 * phaseAngleRad * (isWaxing ? -1 : 1)) / PI,
		angle: positionAngleRad / deg2rad,
		waxing: isWaxing,
	};
}

function moonUpperLimbAltitudeDeg(
	instant: Temporal.Instant,
	latitudeDeg: number,
	longitudeDeg: number,
): number {
	const moonPosition = getMoonPosition(instant, latitudeDeg, longitudeDeg);
	return (
		moonPosition.altitude + (0.2725 * asin(earthRadiusKm / moonPosition.distance)) / deg2rad + 0.09
	);
}

function refineMoonCrossingTime(
	crossingEpochMs: number,
	latitudeDeg: number,
	longitudeDeg: number,
): number {
	let epochMs = crossingEpochMs;
	for (let i = 0; i < 2; i++) {
		const heightDeg = moonUpperLimbAltitudeDeg(
			Temporal.Instant.fromEpochMilliseconds(Math.round(epochMs)),
			latitudeDeg,
			longitudeDeg,
		);
		const heightDerivativeDegPerMs =
			(moonUpperLimbAltitudeDeg(
				Temporal.Instant.fromEpochMilliseconds(Math.round(epochMs + 30_000)),
				latitudeDeg,
				longitudeDeg,
			) -
				moonUpperLimbAltitudeDeg(
					Temporal.Instant.fromEpochMilliseconds(Math.round(epochMs - 30_000)),
					latitudeDeg,
					longitudeDeg,
				)) /
			60_000;
		epochMs -= heightDeg / heightDerivativeDegPerMs;
	}
	return Math.round(epochMs);
}

export function getMoonTimes(
	instant: Temporal.Instant,
	latitudeDeg: number,
	longitudeDeg: number,
): MoonTimes {
	const dayStartInstant = utcMidnight(instant);

	let heightAtWindowStartDeg = moonUpperLimbAltitudeDeg(dayStartInstant, latitudeDeg, longitudeDeg);
	let riseHourOffset: number | undefined;
	let setHourOffset: number | undefined;
	let maxSampledHeightDeg = heightAtWindowStartDeg;

	for (let hour = 1; hour <= 24; hour += 2) {
		const heightOneHourLaterDeg = moonUpperLimbAltitudeDeg(
			instantPlusHours(dayStartInstant, hour),
			latitudeDeg,
			longitudeDeg,
		);
		const heightTwoHoursLaterDeg = moonUpperLimbAltitudeDeg(
			instantPlusHours(dayStartInstant, hour + 1),
			latitudeDeg,
			longitudeDeg,
		);
		maxSampledHeightDeg = Math.max(
			maxSampledHeightDeg,
			heightOneHourLaterDeg,
			heightTwoHoursLaterDeg,
		);

		const quadraticA =
			(heightAtWindowStartDeg + heightTwoHoursLaterDeg) / 2 - heightOneHourLaterDeg;
		const quadraticB = (heightTwoHoursLaterDeg - heightAtWindowStartDeg) / 2;
		const vertexOffset = -quadraticB / (2 * quadraticA);
		const discriminant = quadraticB * quadraticB - 4 * quadraticA * heightOneHourLaterDeg;
		let rootCount = 0;
		let firstRoot = 0;
		let secondRoot = 0;
		const vertexHeight =
			(quadraticA * vertexOffset + quadraticB) * vertexOffset + heightOneHourLaterDeg;

		if (discriminant >= 0) {
			const rootDelta = sqrt(discriminant) / (abs(quadraticA) * 2);
			firstRoot = vertexOffset - rootDelta;
			secondRoot = vertexOffset + rootDelta;
			if (abs(firstRoot) <= 1) rootCount++;
			if (abs(secondRoot) <= 1) rootCount++;
			if (firstRoot < -1) firstRoot = secondRoot;
		}

		if (rootCount === 1) {
			if (heightAtWindowStartDeg < 0) riseHourOffset = hour + firstRoot;
			else setHourOffset = hour + firstRoot;
		} else if (rootCount === 2) {
			riseHourOffset = hour + (vertexHeight < 0 ? secondRoot : firstRoot);
			setHourOffset = hour + (vertexHeight < 0 ? firstRoot : secondRoot);
		}

		if (riseHourOffset !== undefined && setHourOffset !== undefined) break;
		heightAtWindowStartDeg = heightTwoHoursLaterDeg;
	}

	const result: MoonTimes = {};

	if (riseHourOffset !== undefined)
		result.rise = Temporal.Instant.fromEpochMilliseconds(
			refineMoonCrossingTime(
				instantPlusHours(dayStartInstant, riseHourOffset).epochMilliseconds,
				latitudeDeg,
				longitudeDeg,
			),
		);
	if (setHourOffset !== undefined)
		result.set = Temporal.Instant.fromEpochMilliseconds(
			refineMoonCrossingTime(
				instantPlusHours(dayStartInstant, setHourOffset).epochMilliseconds,
				latitudeDeg,
				longitudeDeg,
			),
		);

	if (riseHourOffset === undefined && setHourOffset === undefined) {
		result.alwaysUp = maxSampledHeightDeg > 0;
		result.alwaysDown = maxSampledHeightDeg <= 0;
	}

	return result;
}
