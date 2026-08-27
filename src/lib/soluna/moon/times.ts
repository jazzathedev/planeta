import { deg2rad, earthRadiusKm } from "../shared/constants.ts";
import { instantPlusHours, utcMidnight } from "../shared/time.ts";
import { getMoonPosition } from "./position.ts";
import type { MoonTimes } from "./types.ts";

const { asin, sqrt, abs } = Math;

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
