/** @type {import("prettier").Config} */
const config = {
	useTabs: true,
	tabWidth: 2,
	trailingComma: "all",
	printWidth: 100,
	endOfLine: "lf",
	plugins: ["prettier-plugin-svelte"],
	overrides: [{ files: "*.svelte", options: { parser: "svelte" } }],
};

export default config;
