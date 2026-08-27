// All angles in degrees. Azimuth: 0 = N, 90 = E, 180 = S, 270 = W, clockwise.
export interface HorizontalPosition {
	azimuth: number;
	altitude: number;
}

export interface EquatorialCoordinates {
	// radians!!!
	rightAscension: number;
	// me too!
	declination: number;
}
