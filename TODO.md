## Individual calculations:

1. [x] Astronomical darkness period
2. [x] Moon phase/illumination as a percentage - location + time = phase
3. [x] Avoidance distance for Ha/SII, OIII, LRGB, OSC - location + time + filter + moon phase = avoidance distance
4. [x] Angular distance between Moon and Target - Location + time = angular distance
5. [x] Current Ra/Dec of target - location + j2000.0 + time = jnow
6. [ ] Percentage of frame - Scope FOV + Target size = percentage of frame
7. [ ] Full Moon Happy Hour discount calculations - Session type + Moon illumination = discount https://www.itelescope.net/telescope-full-moon
8. [ ] Robust timezone conversions
9. [ ] Overall score for a given target - Filter avoidance + Time + Location + Discount + Percentage of frame + Weights = overall score
10. [ ] Estimated integration time - Mean surface brightness + Scope f/ratio + exposure time + exposure count = integration time
11. [ ] Usable hours - Target RA/DEC + Location + Time + Scope "horizon" = usable hours
12. [ ] Fuzzy filter/search
13. [ ] Plan creator
    1. [ ] Repeat + count + split up budget
    2. [ ] Sub lengths
    3. [ ] Binning
    4. [ ] Filters
    5. [ ] Name + RA/DEC

## UI features:

### Main

1. [ ] Night selection w. moon phase
2. [ ] Scope/s selection w. f/stop and fov
3. [ ] Search/filter taking in label/name, allows ||
4. [ ] Session length selection
5. [ ] "Fills at least" filter e.g. any, 10%, 50% of frame etc
6. [ ] Type filter e.g. galaxy, emission, cluster, etc
7. [ ] Favourite boolean
8. [ ] Moon illumination display
9. [ ] Target list
   1. [ ] Image
   2. [ ] Score, Scope, Target Names
   3. [ ] Target info e.g. type, size, price
   4. [ ] Filter avoidance results
   5. [ ] Write plan/when is it good
   6. [ ] Elevation chart
   7. [ ] Transit details + time/s

### When good

1. [ ] Target input
2. [ ] Scope/s selection
3. [ ] From, Number of nights ahead, Session length
4. [ ] Image, Name/s, Info
5. [ ] Bars for worth booking, worth and free, not worth, below limit

### Write plan

1. [ ] Image, Name/s, Info+
2. [ ] Session length, Filters presets + manual
3. [ ] Manual RA/DEC + button to override catalogue
4. [ ] Plan itself
5. [ ] Save/Copy/Download

### Setup

1. [ ] Free session cool down
2. [ ] Marking scopes' status
3. [ ] Pricing editing
4. [ ] Adding sites/scopes
5. [ ] Load preset/Backup to file

### My targets

1. [ ] Basic add/remove for custom targets
   1. [ ] Name/s
   2. [ ] Type
   3. [ ] RA/DEC
   4. [ ] Size
   5. [ ] Mag/brightness

## Technical detes:

1. [ ] Store presets on server
2. [ ] Save all user mods to localstorage and be exportable
3. [ ] Avoid search buttons - just make reactive
4. [ ] Images fetched by browser from wikipedia
