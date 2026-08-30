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

- ALL angles are in radians, not hours or degrees. If needed in one of those formats, convert and LABEL
- All coordinates are stored in J2000 equatorial coordinates, not ecliptic or horizontal
- All times are INPUTTED as `Temporal` objects, which are milliseconds since midnight of Jan 1, 1970 UTC. Most calculations are done in Julian days since J2000 UTC
- For night calculations, we will use `astronomicalDusk` to specify the start of astronomical night on the given date, and `astronomicalDawn` to specify the end of the previous night's astronomical night. Therefore we will have a simple `night` which is an alias for `astronomicalDusk` and `nightEnd` which is an alias for TOMORROW's `astronomicalDawn`, to allow for intuitive calculations.
- Whenever converting from one unit to another, never use plain numbers such as `3600`, instead use `secondsPerHour`, etc

## Todo

- [ ] Blank sv create
- [ ] Core types:
  - [ ] Scope
  - [ ] Site
  - [ ] ElevationLimit
  - [ ]
- [ ] Type up maybe 2 scopes from 2 sites
- [ ] Basic storage layer for localstorage loading and saving
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
