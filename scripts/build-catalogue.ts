import {
	num,
	sexagesimalToDecimal,
	trimZero,
	TYPE_LABELS,
	type Catalogue,
	type csvRow,
} from "../src/lib/index.ts";
import * as csv from "fast-csv";
import * as fs from "node:fs";

const ngcicRegex = /(NGC|IC)(\d+)/g;

function prettyName(messier: string, ngc: string, names: string[], name: string) {
	if (num(messier)) {
		return `M ${trimZero(messier)}`;
	}
	if (num(ngc)) {
		return `NGC ${trimZero(ngc)}`;
	}
	if (names.length > 0 && names[0] !== "") {
		return names[0];
	}

	const nameMatch = [...name.matchAll(ngcicRegex)]?.[0];

	if (nameMatch) {
		return `${nameMatch[1]} ${trimZero(nameMatch[2].trimStart())}`;
	}

	return name;
}

function prettyCategory(type: string) {
	if (["G", "GPair", "GTrpl", "GGroup"].includes(type)) return "galaxy";
	if (["PN", "HII", "EmN", "SNR", "Cl+N"].includes(type)) return "emission";
	if (["RfN", "DrkN"].includes(type)) return "dust";
	if (["OCl", "GCl", "*Ass"].includes(type)) return "cluster";
	return "other";
}

function splitCommas(value: string) {
	return value.split(",").map((s) => s.trim());
}

const cataloguePath = "data/NGC.csv";
const addendumPath = "data/addendum.csv";

let catalogueString = fs.readFileSync(cataloguePath, "utf-8");
// Lucky for me, fast-csv doesn't care if you put the headers in a second time!
catalogueString += "\n" + fs.readFileSync(addendumPath, "utf-8");

const catalogue: Catalogue = { source: "OpenNGC (CC-BY-SA-4.0)", objects: [] };

csv
	.parseString(catalogueString, { headers: true })
	.on("data", (row: csvRow) => {
		if (!(row.Type in TYPE_LABELS)) {
			return;
		}

		row.IC = row.IC || row.Name.match("IC(\\d+)")?.[1] || "";
		row.NGC = row.NGC || row.Name.match("NGC(\\d+)")?.[1] || "";

		catalogue.objects.push({
			id: row.Name,
			label: prettyName(row.M, row.NGC, splitCommas(row["Common names"]), row.Name),
			names: splitCommas(row["Common names"]),
			type: TYPE_LABELS[row.Type as keyof typeof TYPE_LABELS],
			category: prettyCategory(row.Type),
			constellation: row.Const,
			ra: sexagesimalToDecimal(row.RA),
			dec: sexagesimalToDecimal(row.Dec),
			maj: num(row["MajAx"]),
			min: num(row["MinAx"]),
			pa: num(row["PosAng"]),
			vmag: num(row["V-Mag"]),
			bmag: num(row["B-Mag"]),
			sb: num(row["SurfBr"]),
			identifiers: splitCommas(row.Identifiers),
			ic: num(row.IC),
			ngc: num(row.NGC),
			messier: num(row["M"]),
		});
	})
	.on("end", () => {
		// Note: the \t helps but the catalogue will still be formatted by prettier
		fs.writeFileSync("static/catalogue.json", JSON.stringify(catalogue, null, "\t"));
	});
