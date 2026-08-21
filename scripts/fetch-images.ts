import { sleep, WikiFirstPage, type Catalogue } from "$lib";
import * as fs from "node:fs";

const wikiAPI = "https://en.wikipedia.org/w/api.php";

async function getImageURL(title: string) {
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
		} else {
			if (!page.data.missing) {
				return page.data.thumbnail;
			} else {
				return undefined;
			}
		}
	} catch (e) {
		console.error(`fetch failed for "${title}":`, e);
		return undefined;
	}
}

const catalogueString = fs.readFileSync("static/catalogue.json", "utf-8");
const catalogue: Catalogue = JSON.parse(catalogueString);

const imagesPath = "static/images.json";
let catalogueImages: { [key: string]: { url: string; width: number; height: number } } = {};
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
		const image = await getImageURL(obj.label);
		if (image) {
			catalogueImages[obj.id] = { url: image.source, width: image.width, height: image.height };
			console.log(obj.id, image.source);
		} else {
			console.log(obj.id, "no image found");
		}
	} catch (e) {
		console.error(obj.id, "error:", e);
	}
	fs.writeFileSync(imagesPath, JSON.stringify(catalogueImages, null, "\t"));

	await sleep(500);
}
