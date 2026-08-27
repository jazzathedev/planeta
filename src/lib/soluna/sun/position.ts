import { deg2rad } from "../shared/constants.ts";
import { instantToDaysSinceJ2000, toTerrestrialTime } from "../shared/time.ts";
import {
	altitudeFromHourAngle,
	atmosphericRefractionRad,
	azimuthFromHourAngle,
	greenwichMeanSiderealTime,
} from "../shared/astro.ts";
import type { HorizontalPosition } from "../shared/types.ts";
import { getSunEquatorialCoordinates } from "./coordinates.ts";

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
