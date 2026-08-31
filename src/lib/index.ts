export function range(value: number, max: number): number {
	return ((value % max) + max) % max;
}
