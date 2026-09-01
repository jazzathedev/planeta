import { range } from "$lib";

export type ElevationLimit = {
	minAltitude: number;
	azimuth: [number, number];
};

export type Scope = {
	/** E.g. T68 */
	id: string;
	/** E.g. U94, EEyE */
	siteId: string;
	costType: "free" | "paid";
	/** Exclude from UI, ranking, etc */
	enabled?: boolean;
	reason?: string;
	/** 30 for always-free scopes, 60 for paid scopes when free */
	defaultSession: number;
	optics: {
		design: string;
		apertureMm: number;
		focalLengthMm: number;
		realFRatio: number;
	};
	sensor: {
		name: string | null;
		cameraName: string | null;
		type: "CCD" | "CMOS";
		antiBloomGate: boolean | null;
		/**Unbinned */
		pixelSizeUm: number;
		/**Unbinned */
		pixelArray: [number, number];
		/** Unbinned */
		sensorSizeMm: [number, number];
		oneShotColour: boolean;
	};
	arcsecPerPixel: number;
	fovArcmin: [number, number];
	angleDeg: number | null;
	maxExposureSec: number;
	binning: {
		allowed: number[];
		preferred: number;
	};
	filters: string[];
	/** Usually `Clear` or `Luminance` */
	luminanceFilter: string | null;
	elevationLimits: ElevationLimit[];
	subLength: {
		calibrationLibrary: number[] | null;
		minSeconds: number;
		narrowMinSeconds: number | null;
		maxSeconds: number;
		narrowMaxSeconds: number | null;
	};
	notes: string;
	reference: string;
};

export type Site = {
	/** E.g. U94, EEyE */
	id: string;
	shortName: string;
	name: string;
	locationName: string;
	latitude: number;
	longitude: number;
	elevationMetres: number;
	timezone: string;
	scopes: string[];
	enabled?: boolean;
	reason?: string;
};

export type ScopeSchema = {
	$schema: string;
	scopes: Scope[];
};

export type SiteSchema = {
	$schema: string;
	sites: Site[];
};

export const NARROW_BANDS = ["Ha", "SII", "OIII"];

export const isNarrowBand = (filter: string): boolean => NARROW_BANDS.includes(filter);

const azInRange = (azimuth: number, [from, to]: [number, number]): boolean => {
	const normalisedAz = range(azimuth, 360);
	// No wrap
	if (from <= to) return normalisedAz >= from && normalisedAz <= to;
	else return normalisedAz >= from || normalisedAz <= to;
};

/**
 * Minimum altitude for a given azimuth. If ranges overlap, the highest is returned.
 * @param scope The scope to check
 * @param azimuth Given azimuth to map to minimum altitude required. Normalised to 0-360 degrees
 * @returns Degrees above the horizon
 */
export function minAltitudeAt(scope: Scope, azimuth: number): number {
	let limit = 0;

	for (const rule of scope.elevationLimits)
		if (azInRange(azimuth, rule.azimuth)) limit = Math.max(limit, rule.minAltitude);

	return limit;
}

export function exposureBudget(sessionMinutes: number): number {
	return sessionMinutes / 1.5;
}
