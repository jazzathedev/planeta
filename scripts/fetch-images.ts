import { sleep, WikiFirstPage, type Catalogue } from "$lib";
import * as fs from "node:fs";

const wikiAPI = "https://en.wikipedia.org/w/api.php";

async function getWikiData(title: string) {
	const params = new URLSearchParams({
		action: "query",
		format: "json",
		formatversion: "2",
		prop: "pageimages",
		piprop: "thumbnail",
		pithumbsize: "500",
		redirects: "1",
		titles: title,
	});

	try {
		const res = await fetch(`${wikiAPI}?${params}`, {
			headers: { "User-Agent": "admin@jazza.dev" },
		});
		if (!res.ok) {
			console.error(
				`Wiki API HTTP ${res.status} for "${title}": ${await res.text().then((t) => t.slice(0, 200))}`,
			);
			return undefined;
		}
		const data = await res.json();
		const page = WikiFirstPage.safeParse(data);

		if (!page.success) {
			return undefined;
		}
		if (page.data.missing) {
			return undefined;
		}

		// Build page URL from final title (after redirects) + optional fragment
		// e.g. "Messier 101" -> redirects to "Pinwheel Galaxy" -> https://en.wikipedia.org/wiki/Pinwheel_Galaxy
		const raw = data as {
			query?: { redirects?: { from: string; to: string; tofragment?: string }[] };
		};
		let fragment: string | undefined;
		if (raw.query?.redirects?.length) {
			fragment = raw.query.redirects[raw.query.redirects.length - 1].tofragment;
		}
		const finalTitle: string = page.data.title;
		const encodedTitle = encodeURIComponent(finalTitle.replace(/ /g, "_"));
		const pageUrl = `https://en.wikipedia.org/wiki/${encodedTitle}${fragment ? `#${encodeURIComponent(fragment.replace(/ /g, "_"))}` : ""}`;

		return {
			thumbnail: page.data.thumbnail,
			pageUrl,
		};
	} catch (e) {
		console.error(`fetch failed for "${title}":`, e);
		return undefined;
	}
}

const catalogueString = fs.readFileSync("static/catalogue.json", "utf-8");
const catalogue: Catalogue = JSON.parse(catalogueString);

const imagesPath = "static/images.json";
let catalogueImages: {
	[key: string]: { url: string; width: number; height: number; pageUrl: string };
} = {};
if (fs.existsSync(imagesPath)) {
	try {
		catalogueImages = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));
		console.log(`Resuming - ${Object.keys(catalogueImages).length} already done, skipping...`);
	} catch {
		catalogueImages = {};
	}
}

for (const obj of catalogue.objects) {
	if (catalogueImages[obj.id]) {
		console.log(obj.id, "skipped - already done");
		continue;
	}
	try {
		const data = await getWikiData(obj.label);
		if (data?.thumbnail) {
			catalogueImages[obj.id] = {
				url: data.thumbnail.source,
				width: data.thumbnail.width,
				height: data.thumbnail.height,
				pageUrl: data.pageUrl,
			};
			console.log(obj.id, data.thumbnail.source, "->", data.pageUrl);
		} else {
			console.log(obj.id, "no image found");
		}
	} catch (e) {
		console.error(obj.id, "error:", e);
	}
	fs.writeFileSync(imagesPath, JSON.stringify(catalogueImages, null, "\t"));

	await sleep(500);
}
