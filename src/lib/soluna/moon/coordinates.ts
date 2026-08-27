import { deg2rad } from "../shared/constants.ts";
import type { EquatorialCoordinates } from "../shared/types.ts";
import { MOON_LAT_TABLE, MOON_LON_TABLE } from "./tables.ts";

const { sin, cos, tan, asin, atan2 } = Math;

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

export function getMoonEquatorialCoordinates(
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

	const ra = atan2(
		sin(apparentEclipticLongitudeRad) * cos(trueObliquityRad) -
			tan(eclipticLatitudeRad) * sin(trueObliquityRad),
		cos(apparentEclipticLongitudeRad),
	);

	return {
		rightAscension: (ra + 2 * Math.PI) % (2 * Math.PI),
		declination: asin(
			sin(eclipticLatitudeRad) * cos(trueObliquityRad) +
				cos(eclipticLatitudeRad) * sin(trueObliquityRad) * sin(apparentEclipticLongitudeRad),
		),
		distanceKm: 385000.56 + sumDistanceMeters / 1000,
	};
}
