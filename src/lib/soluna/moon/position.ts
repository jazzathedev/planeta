import { deg2rad, earthRadiusKm } from "../shared/constants.ts";
import { instantToDaysSinceJ2000, toTerrestrialTime } from "../shared/time.ts";
import {
	altitudeFromHourAngle,
	atmosphericRefractionRad,
	azimuthFromHourAngle,
	greenwichMeanSiderealTime,
} from "../shared/astro.ts";
import { getMoonEquatorialCoordinates } from "./coordinates.ts";
import type { MoonPosition } from "./types.ts";

const { sin, cos, tan, asin, atan2 } = Math;

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
