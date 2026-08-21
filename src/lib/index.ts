import z from "zod";

// place files you want to import through the `$lib` alias in this folder.
export type Catalogue = {
	source: string;
	objects: Object[];
};

export type Object = {
	id: string;
	label: string;
	names: string[];
	type: string;
	category: string;
	constellation: string;
	ra: number;
	dec: number;
	maj: number | null;
	min: number | null;
	pa: number | null;
	vmag: number | null;
	bmag: number | null;
	sb: number | null;
	identifiers: string[] | null;
	ic: number | null;
	ngc: number | null;
	messier: number | null;
};

export interface csvRow {
	Name: string;
	Type: string;
	RA: string;
	Dec: string;
	Const: string;
	MajAx: string;
	MinAx: string;
	PosAng: string;
	"B-Mag": string;
	"V-Mag": string;
	"J-Mag": string;
	"H-Mag": string;
	"K-Mag": string;
	SurfBr: string;
	Hubble: string;
	Pax: string;
	"Pm-RA": string;
	"Pm-Dec": string;
	RadVel: string;
	Redshift: string;
	"Cstar U-Mag": string;
	"Cstar B-Mag": string;
	"Cstar V-Mag": string;
	M: string;
	NGC: string;
	IC: string;
	"Cstar Names": string;
	Identifiers: string;
	"Common names": string;
	"NED notes": string;
	"OpenNGC notes": string;
	Sources: string;
}

export const TYPE_LABELS = {
	G: "galaxy",
	GPair: "galaxy pair",
	GTrpl: "galaxy triplet",
	GGroup: "galaxy group",
	PN: "planetary nebula",
	HII: "HII region",
	DrkN: "dark nebula",
	EmN: "emission nebula",
	Neb: "nebula",
	RfN: "reflection nebula",
	SNR: "supernova remnant",
	"Cl+N": "cluster with nebulosity",
	OCl: "open cluster",
	GCl: "globular cluster",
	"*Ass": "stellar association",
	Other: "other",
};

export const WikiPageMissing = z.object({
	ns: z.number(),
	title: z.string(),
	missing: z.literal(true),
});

export const WikiPageWithThumbnail = z.object({
	pageid: z.number(),
	ns: z.number(),
	title: z.string(),
	missing: z.literal(false).optional(),
	thumbnail: z
		.object({
			source: z.string(),
			width: z.number(),
			height: z.number(),
		})
		.optional(),
});

export const WikiPage = z.discriminatedUnion("missing", [WikiPageMissing, WikiPageWithThumbnail]);

export const WikiApiResponse = z.object({
	batchcomplete: z.boolean(),
	query: z.object({
		pages: z.array(WikiPage).min(1),
	}),
});

export const WikiFirstPage = WikiApiResponse.transform((data) => data.query.pages[0]);

export function sexagesimalToDecimal(value: string): number {
	const parts = value.trim().split(":");

	if (parts.length !== 3) {
		throw new Error(`Invalid sexagesimal value: ${value}`);
	}

	const [degrees, minutes, seconds] = parts.map(Number);

	if (
		![degrees, minutes, seconds].every(Number.isFinite) ||
		Math.abs(minutes) > 60 ||
		Math.abs(seconds) > 60
	) {
		throw new Error(`Invalid sexagesimal value: ${value}`);
	}

	const sign = value.trim().startsWith("-") ? -1 : 1;

	return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}

export function num(v?: string) {
	if (v === undefined || v === "") return null;
	const n = Number(v);
	return Number.isNaN(n) ? null : n;
}

export const trimZero = (s: string) => {
	return s.replace(/^[0]+/g, "");
};

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
