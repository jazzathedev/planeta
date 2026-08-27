/**
 *
 * @param value format hh:mm:ss.ss or dd:mm:ss.ss
 * @see https://en.wikipedia.org/wiki/Sexagesimal
 * @description Converts sexagesimal to decimal. E.g. 05:40:59.00 > 5.6830555 OR -02:27:30.00 > -2.458333
 * @returns decimal value
 */
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

export function between(value: number, min: number, max: number) {
	return value >= min && value <= max;
}

export function anyNaN(...values: number[]) {
	return values.some((v) => isNaN(v));
}
