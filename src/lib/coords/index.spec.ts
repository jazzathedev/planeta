import { describe, it, expect } from "vitest";
import { angularDistance, angularDistanceToMoon } from ".";
import { instantToDaysSinceJ2000 } from "$lib/soluna";

describe("angularDistance", () => {
	it("returns null for invalid coordinates", () => {
		expect(angularDistance(Infinity, 0, 0, 0)).toBeNull();
		expect(angularDistance(NaN, -1, 0, NaN)).toBeNull();
	});

	it("returns null for out-of-range coordinates", () => {
		expect(angularDistance(-0.1, 0, 0, 0)).toBeNull();
		expect(angularDistance(2 * Math.PI + 0.1, 0, 0, 0)).toBeNull();
		expect(angularDistance(0, Math.PI / 2 + 0.1, 0, 0)).toBeNull();
	});

	it("returns the angular distance between two coordinates", () => {
		expect(angularDistance(1.493638, -0.04261513, 5.794711, -0.1869442)).toBeCloseTo(1.965544);
		expect(angularDistance(2 * Math.PI, Math.PI / 2, 0, 0)).toBeCloseTo(1.570796);
		expect(angularDistance(0, 0, 0, 0)).toBeCloseTo(0);
	});
});

describe("angularDistanceToMoon", () => {
	it("returns the angular distance between the moon and a point", () => {
		expect(
			angularDistanceToMoon(
				0.207476,
				-0.4413728,
				instantToDaysSinceJ2000(Temporal.Instant.from("2027-01-01 21:06+08")),
			),
		).toBeCloseTo(2.3644972246);
	});

	it("returns null for invalid coordinates", () => {
		expect(angularDistanceToMoon(Infinity, 0, 0)).toBeNull();
		expect(angularDistanceToMoon(NaN, 0, 0)).toBeNull();
		expect(angularDistanceToMoon(0, 0, NaN)).toBeNull();
		expect(angularDistanceToMoon(0, 0, Infinity)).toBeNull();
	});
});
