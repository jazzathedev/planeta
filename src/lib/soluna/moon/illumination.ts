import { deg2rad, sunDistanceKm } from "../shared/constants.ts";
import { instantToDaysSinceJ2000, toTerrestrialTime } from "../shared/time.ts";
import { getSunEquatorialCoordinates } from "../sun/coordinates.ts";
import { getMoonEquatorialCoordinates } from "./coordinates.ts";
import type { MoonIllumination } from "./types.ts";

const { PI, sin, cos, acos, atan2 } = Math;

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
