import { browser } from "$app/environment";

const prefix = "planeta:";

export function read<T extends object>(key: string, defaultValue: T): T {
	const baseValue = structuredClone(defaultValue);
	if (!browser) return baseValue;

	try {
		const rawValue = localStorage.getItem(prefix + key);
		if (rawValue === null) return baseValue;

		return { ...baseValue, ...JSON.parse(rawValue) };
	} catch {
		// Someone or something broke my precious localStorage entry
		return baseValue;
	}
}

export function write(key: string, value: unknown) {
	if (!browser) return;

	try {
		localStorage.setItem(prefix + key, JSON.stringify(value));
	} catch (e) {
		throw new Error(`Failed to write to localStorage: ${e}`, { cause: e });
	}
}

export function has(key: string): boolean {
	if (!browser) return false;
	return localStorage.getItem(prefix + key) !== null;
}

export function remove(key: string) {
	if (!browser) return;
	localStorage.removeItem(prefix + key);
}
