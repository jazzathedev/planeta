# Non-comprehensive "list" of tasks

## Tech Stack

- Svelte 5
- SvelteKit 2, migrating to 3 when it's out
- TypeScript
- `astronomy-engine` - might be modified to use Temporal, might just make helpers
- `.json` files for catalogue, presets, etc, `localStorage` for user state
- pnpm
- Cloudflare Workers via wrangler

## Consistency rules

There will always be exceptions to these rules, but hopefully not too many.

- ALL angles are in degrees where possible, not hours. If needed in another format, convert and LABEL
- All coordinates are stored in J2000 equatorial coordinates, not ecliptic or horizontal
- All times are INPUTTED as `Temporal` objects, which are milliseconds since midnight of Jan 1, 1970 UTC. Most calculations are done in Julian days since J2000 UTC
- For night calculations, we will use `astronomicalDusk` to specify the start of astronomical night on the given date, and `astronomicalDawn` to specify the end of the previous night's astronomical night. Therefore we will have a simple `night` which is an alias for `astronomicalDusk` and `nightEnd` which is an alias for TOMORROW's `astronomicalDawn`, to allow for intuitive calculations.
- Whenever converting from one unit to another, never use plain numbers such as `3600`, instead use `secondsPerHour`, etc

## Todo

- [x] Blank sv create
- [x] Core types:
  - [x] Scope
  - [x] Site
  - [x] ElevationLimit
  - [ ]
- [x] Type up maybe 2 scopes from 2 sites
- [x] Basic storage layer for localstorage loading and saving
- [ ] Storage into a database for cross-device syncing
- [ ] Ephemeris layer
  - [ ] `astronomicalNight` - The astronomical night on a given `isoDate` string, `Temporal.Instant`, or `Temporal.PlainDate`
  - [ ] `separation` - Angular separation between two `SkyTarget`s in radians
  - [ ] `buildNight` - Everything about a night that doesn't depend on a target, built per Site
  - [ ] `trackThroughNight` - Array of the alt/az of a target through the night
  - [ ]
- [ ] Moon model
  - [ ] `avoidanceDistance` - Distance needed between a target and the moon to avoid interference, per filter class
  - [ ] `assessMoon` - Given `moonAlt` and `moonSeparation`, `MoonIllumination`, `filterClass`, give back `verdict` string, worst separation, required separation, and how long moon is up
  - [ ] `moonPhaseName` - Given `moonIllumination` and `waxing` boolean, give back common name of moon phase

```ts
const filterFactor: Record<FilterType, number> = { HaSII: 1, OIII: 1.5, LRGB: 2, OSC: 2.3 };

export function moonAvoidanceDeg(filter: FilterType, illumination: number): number {
	const i = Math.max(0, Math.min(1, illumination)) * 100;
	const ha = 19.954 + 0.3868 * i;
	return ha * filterFactor[filter];
}
```

- [ ] Plan parser for testing and validation
- [ ] Candidates, tonight, ranking
  - [ ] Pre filter by a simple altitude check against telescope and user floor: 90 - abs(lat - dec)
  - [ ] Pre filter by simple framing check: size is > 8% of frame or smaller than 300% of frame (numbers chosen to get rid of obviously bad targets but allow user to choose to shoot something small or big)
  - [ ] Final filters: has common name/s, has messier name, has mag less than 12.5 (lower = brighter)
  - [ ] Score by many: `usableHours`, `maxAlt`, if it has separated windows, `fit`, `moon` etc etc
- [ ] Altitude chart - draw scope's limits with the elevation of the target, and moon elevation
- [ ] Exposure generator - emit a file with the sub exposures, math to hit the safe session length (approx 10-20 minutes less than full session), comments, etc
- [ ] Plan store - `savePlan` and `loadPlan` with archiving, making sure something like a mosaic saves both as a all-at-once file and as a directory of per-tile-files
- [ ] Manual layer - availability changes, conditions, pricing changes, scope or site changes
- [ ] Estimated exposure time - base on surface brightness, sky brightness, filters, calculate based on the f/5 equivalent
- [ ] "When does this target get good" - map out the days given target is good on given scopes, and when its free also
- [ ] Mosaic importing from telescopius
- [ ] Offer fleet preset or starting from anew

## Less structured planning stuff

I am trying to treat this project as a lot more... professional? Doing proper planning, thinking about tests and overall architecture, much more than my usual "I'm just going to write a bunch of code and hope it works"

### Directional elevation limits

- Scopes are, often in the case of iTelescope, not limited by just one minimum altitude. T68 for example has 2 elevation limits: 15 degrees on all azimuths, but 17 degrees between 60 and 120 degrees azimuth
- If we chose the obvious approach of a single elevation limit, we may miss some targets that we CAN image, or claim we can image some that we CAN'T
- It also means that a target's visibility can be split through the night; it can be visible from 2300 to 0200, but then hidden until 0300

```ts
type ElevationLimits = {
	az: [number, number];
	min_alt: number;
}[];
```

- The `az` numbers can be 1. overlapped and 2. wrap around 360
  - We will parse from top to bottom, so if we define T68 as 15 degrees from 0 to 360, we can later define 17 degrees from 60 to 120 and that will "replace" the "global" rule
  - We can also define something like 270 to 90 degrees, it passes through the wrap around point but still works

```ts
function azInRange(az: number, [from, to]: [number, number]): boolean {
	// I'll probably make this normalisation step a helper
	const azimuth = ((az % 360) + 360) % 360;
	// If we don't wrap around, we can just compare
	if (from <= to) return azimuth >= from && azimuth <= to;
	// Wrap around, so it's an OR
	else return azimuth >= from || azimuth <= to;
}

// Not sure of Scope's full shape, but it will have ElevationLimits
function minAltitudeAt(scope: Scope, azimuth: number): number {
	let limit = 0;
	for (const rule of scope.elevationLimits)
		// This max is so that we always choose the highest elevation limit
		// because, remember, we can "replace" the global rule
		if (azInRange(azimuth, rule.az)) limit = Math.max(limit, rule.min_alt);
	return limit;
}
```

### Performance via splitting

- We have to score several thousand targets, on dozens of scopes, in the browser, fast enough to support reactive UI. That means we have to be careful about how we do things
- `NightTrack` will be per-site and per-night (nice, rhymes). This will contain the timestep duration (we can't do a continual sample so we need to break it into steps), the local apparent sidereal time at each step, the moon's RA/Dec/altitude at each step, and the illuminated fraction at mid-night (it doesn't change enough during the night to be worth storing)
- `SiteTrack` will be per-site and per-target. Contains the alt/az of a target, as well as it's moon separation throughout the night
- `TargetTrack` will apply `minAltitudeAt` to the `SiteTrack`, and figure out windows, usable hours, etc
- We can use `SkyCache` to memoise `SiteTrack` and `TargetTrack`

- We should also do alt/az by the hour angle, not by Astronomy Engine's function, because `NightTrack` already uses the local sidereal time, so a spherical transform is enough

```ts
// https://en.wikipedia.org/wiki/Sight_reduction
let localHourAngle = (localSiderealTime - target.ra.toHours()) * 15;
let altitude = asin(
	sin(observer.lat) * sin(target.dec) + cos(target.dec) * cos(observer.lat) * cos(localHourAngle),
);
let azimuth = acos(
	(sin(target.dec) - sin(altitude) * sin(observer.lat)) / (cos(altitude) * cos(observer.lat)),
);
azimuth = sin(azimuth) > 0 ? 360 - azimuth : azimuth;
```

- Precession can be applied once per night per target, since over 6 hours the position moves an insanely small amount

### Ranking

- Scoring targets is a hard problem, I am thinking we combine a "cool" score with an "odds" score:
  - Cool (datetime independent): how good the picture is, based on framing, how well does the filter fit (aka an emission wants Ha/SII and OIII, a galaxy wants LRGB), how bright it is
  - Odds (datetime dependent): altitude, window, moon info
- We use both because a target could make for an amazing photo, but it's a really bad time to try and take said photo. The weighting for all of these is going to be HELL.

### Plan generation

The iTelescope plan file format:

```
; comment block carrying the reasoning
#BillingMethod Session
#tiff
#repeat 2
#count 4,3,3,3
#interval 180,180,180,180
#binning 1,1,1,1
#filter Luminance,Red,Green,Blue
;
; Mosaic targets for ... (second comment block)
;
M 81<TAB>9.925881<TAB>69.065295
#shutdown
```

### Catalogue corrections and overrides

- We have the OpenNGC CSVs which we can convert to JSON and throw away information we don't need. We can also fold in their own corrections at build time.
- We will have to fold in our own runtime corrections however, OpenNGC catalogues targets for science, not for imaging. For example, NGC 5457 is placed at `ra = 14.0535, dec = 54.3488` but to properly frame it, I would aim at `ra = 14.0524, dec = 54.3966`
- This will be keyed either by `target` or `target@scope` because the best centre is field dependent: what puts the whole Veil in a 4 degree frame is not what centres the interesting part on a narrow one.
- The catalogue is like 3MB so we can't store it in `localStorage`, so we will fetch it and let the browser cache it.
