import z from "zod";

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
