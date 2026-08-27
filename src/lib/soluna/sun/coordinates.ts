import { deg2rad } from "../shared/constants.ts";
import type { EquatorialCoordinates } from "../shared/types.ts";

const { sin, cos, asin, atan2 } = Math;

export function getSunEquatorialCoordinates(daysSinceJ2000TT: number): EquatorialCoordinates {
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

	const ra = atan2(
		cos(trueObliquityRad) * sin(apparentEclipticLongitudeRad),
		cos(apparentEclipticLongitudeRad),
	);

	return {
		rightAscension: (ra + 2 * Math.PI) % (2 * Math.PI),
		declination: asin(sin(trueObliquityRad) * sin(apparentEclipticLongitudeRad)),
	};
}
