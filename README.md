# Wakesurf Timer for BUSY Bar

A ride timer for boat captains. Made for wakesurfing; works the same for wakeboarding and waterskiing.

The captain starts the clock when the rider is up and pauses it when the rider falls.
When the ride is over, one button press saves it. The bar keeps the **last 20 rides**, each with:

| Field | Meaning |
|---|---|
| **Ride #** | Running ride number (keeps counting across sessions) |
| **Date / Start** | Month/day and hour:minute when the ride started, e.g. `11/22 17:13` |
| **Surf time** | Time the rider was actually surfing. Pauses are **not** counted |
| **Clock time** | Wall time from start to end of the ride. Pauses **are** counted |
| **Falls** | How often the ride was paused and resumed |

The difference between clock time and surf time is the time spent picking the rider up after falls.

---
## Required Hardware: 
https://busy.app/

## User manual

### Buttons

| Button | Where on the bar |
|---|---|
| **START** | Big button on top |
| **OK** | Pressing the wheel |
| **Wheel** | Turning the wheel |
| **BACK** | Back button |

### A typical session

1. **Open the app** from the bar's app menu: look for the blue wave and *Wakesurf Timer*.

   ![App menu entry with the wave icon](docs/screenshots/front-app-menu.png)


   The front shows `WAKESURF / PRESS START`.
2. **Press START** to begin the session. The display shows `READY` and the number of the next ride.
3. **Rider is up: press START.** The clock runs, the front shows **SURF** in green.
4. **Rider falls: press START.** The clock stops, the front shows **PAUSE** in yellow, the fall counter goes up (`F1`, `F2`, …).
5. **Rider is back up: press START** again to continue the same ride.
6. **Ride is over: hold START** (about a second). The ride is saved and the clock goes back to `READY` for the next rider.
   The usual way is: rider falls → press START (pause) → if the ride is over, hold START.
   If you finish while paused, that last pause is counted as the end of the ride, not as a fall,
   and the clock time ends at the moment you paused.
7. Repeat 3–6 for every rider.
8. **End the session:** press **BACK** while `READY`.
9. **Leave the app:** press **BACK** on the start screen.

You never need OK. It still works as a second way to finish a ride (press) or end the session (hold),
but see *Troubleshooting* if the bar is connected to Home Assistant.

### All buttons by screen

| Screen | START | Hold START | BACK | Wheel | OK (optional) |
|---|---|---|---|---|---|
| Start screen | start session | – | quit app | open history | open history |
| READY | start ride | – | end session | open history | open history; hold: end session |
| SURF (riding) | pause (fall) | **finish & save ride** | *ignored* | *ignored* | finish & save ride |
| PAUSE | resume | **finish & save ride** | *ignored* | *ignored* | finish & save ride |
| History | close history, start ride | – | close history | scroll | close history |

BACK and the wheel do nothing while a ride is running, so the clock can't be lost by a stray press.
Rides shorter than 2 seconds are ignored (accidental double press).
Holding BACK always force-quits the app (built into the bar); a running ride is then lost.

### What the displays show

**Front (72×16, colour)**: surf time on the left (9 dots tall); state, ride number and falls on the right (7 dots tall). No text on the front is smaller than 7 dots, so it stays readable from the helm.

| State | Front display |
|---|---|
| **READY**: waiting for the next rider (grey clock at 00:00, ride #11 next) | ![Front display: READY](docs/screenshots/front-ready.png) |
| **SURF**: rider is up, clock running (green) | ![Front display: SURF](docs/screenshots/front-surf.png) |
| **PAUSE**: rider fell, clock stopped (yellow), `F1` = 1 fall | ![Front display: PAUSE](docs/screenshots/front-pause.png) |

**Back (greyscale)**

- top: ride number and how long the session has been running
- middle: large surf time, state, `CLOCK mm:ss  FALLS n`
- below: button hints
- bottom: surf times of the last 4 rides

### History

Turn the wheel on the start screen or on `READY` to open the history.

- **Front:** bottom row: surf time (cyan, left) and clock time (blue, right).
  Top row: alternates every 2 s between `RIDE #10` and the start date/time `11/22 17:13`.
  All text uses the 7-dot font so it stays readable from the helm.
- **Back:** table of 5 rides around the selection: `RIDE  DATE START  SURF  CLOCK  F`.
  The selected ride has a frame; `3/20` at the bottom shows the position.

![Back display: ride history table](docs/screenshots/back-history.png)

*Ride #10 started on 11/22 at 17:13: 9 s surfing, 12 s on the clock, 1 fall.
Rides #8 and older were recorded with version 1.0, so they have no date.
The icons on the right edge belong to the bar itself.*

Turn the wheel to scroll, press BACK to close.
Rides recorded with version 1.0 have no date and show `--/-- --:--`.

### Status light

The LED blinks once on each state change: blue = ready, green = ride started or resumed,
yellow = paused, red = session ended.

### Date and time

The start time comes from the bar's own clock (synced over Wi-Fi, time zone set in the BUSY app).
If the bar's clock is wrong, the ride times are still right but the date/start is off.

---

## Troubleshooting

**Pressing OK shows a house / "Home Assistant" screen.**
That screen comes from the *BUSY Bar* integration in Home Assistant, not from this app.
It reacts to the bar's OK button and draws its dashboard with display priority 100, covering the timer.
The timer keeps running underneath and the ride is still saved. Press BACK to close that screen.
That's why the app uses **hold START** to finish a ride: you never need to press OK.
It only happens while the bar can reach Home Assistant (home Wi-Fi), so not on the boat.
While that screen is open, the wheel controls the Home Assistant accessory shown on it.

**Reading the bar's log** (over USB):

```powershell
Invoke-RestMethod -Method Post "http://10.0.4.20/api/log_dump?filename=log"
```

Then download `/ext/log.txt` with `storage/read` (same as the history file below).

## Install / update

The easiest way is the BUSY app catalog. There are two other ways: upload the release file in the bar's web interface, or build from source.

App installs only work over **USB**: over Wi-Fi the bar refuses them (403 Forbidden).

### Option A: upload the release file (no tools needed)

1. Download `io.github.superwolfi82.wakesurf.tgz` from the [latest release](https://github.com/superwolfi82/BusyBar_WakeSurfTimer/releases/latest)
   ([direct link](https://github.com/superwolfi82/BusyBar_WakeSurfTimer/releases/latest/download/io.github.superwolfi82.wakesurf.tgz)).
2. Connect the BUSY Bar to the PC with a USB-C cable.
3. Open [http://10.0.4.20/](http://10.0.4.20/) in a browser and go to **Apps**.
4. Click **Add app**, then drop the `.tgz` file on the *Upload app file* box (or click **Select file**).
5. *Wakesurf Timer* now shows up under *Your apps* and in the bar's app menu.

To update, upload the newer `.tgz` the same way. Your ride history is kept.

### Option B: build from source

1. Install [Node.js](https://nodejs.org) 24 or newer.
2. Connect the BUSY Bar to the PC with a USB-C cable (it is then reachable at `10.0.4.20`).
3. In this folder run:

```powershell
.\deploy.ps1
```

This builds `src\` with `busy-cli` into `dist\io.github.superwolfi82.wakesurf.tgz`, installs it and starts it.
Your ride history is kept when you update.
(Versions before 1.4.0 used the app ID `app.wakesurf.timer`; their history stays with that old app.)

Without PowerShell, `npm ci` then `npm run build` and `npm run app:install` do the same.

Other options:

```powershell
.\deploy.ps1 -PackageOnly
```

```powershell
.\deploy.ps1 -Launch
```

```powershell
.\deploy.ps1 -Quit
```

After installing, the app also appears in the bar's app menu, so a PC is not needed on the boat.

### Making a release

Bump the version in `src/appmeta/manifest.json` and `package.json`, commit, then push a matching tag:

```powershell
git tag v1.5.0
```

```powershell
git push origin v1.5.0
```

The [release workflow](.github/workflows/release.yml) builds the `.tgz` with `busy-cli` and attaches it to a new GitHub release.
It stops if the tag does not match the version in both files.

### Publishing an update to the BUSY app catalog

The catalog does **not** watch GitHub releases or tags. It builds exactly the commit named in
`commit_sha` of the catalog entry
[`applications/io.github.superwolfi82.wakesurf/manifest.yml`](https://github.com/busy-app/busy-apps-catalog/blob/main/applications/io.github.superwolfi82.wakesurf/manifest.yml).
Every new version needs a new pull request to [busy-app/busy-apps-catalog](https://github.com/busy-app/busy-apps-catalog)
that changes that one file. Full rules: the catalog's [CONTRIBUTING.md](https://github.com/busy-app/busy-apps-catalog/blob/main/CONTRIBUTING.md).

**Before you start**

- The new `version` in `src/appmeta/manifest.json` must be **higher** than the version in the catalog, otherwise the check fails.
- Keep the app ID `io.github.superwolfi82.wakesurf` and this repository. The catalog only accepts updates from the repo the app was first published from.
- If the display looks different now, replace the PNGs in `screenshots/` (front 72×16, back 160×80, taken from the bar) before the release commit.
  The catalog only shows new description and screenshots together with a new version.

**Steps** (needs [GitHub CLI](https://cli.github.com) `gh`, logged in as superwolfi82; example for v1.6.0)

1. Make the release as described above (version bump, commit, push, tag `v1.6.0`).
2. Get the full commit SHA of the release (the catalog takes no tag or branch names):

   ```powershell
   git rev-parse "v1.6.0^{commit}"
   ```

3. Get a fresh copy of the catalog from your fork (`superwolfi82/busy-apps-catalog`; the first time run `gh repo fork busy-app/busy-apps-catalog --clone=false`):

   ```powershell
   gh repo sync superwolfi82/busy-apps-catalog
   ```

   ```powershell
   gh repo clone superwolfi82/busy-apps-catalog $env:TEMP\busy-apps-catalog
   ```

   ```powershell
   cd $env:TEMP\busy-apps-catalog; git checkout -b update-wakesurf-1.6.0
   ```

4. Edit `applications/io.github.superwolfi82.wakesurf/manifest.yml` and change **only**:
   - `commit_sha:` the 40-character SHA from step 2, with the tag as a comment: `commit_sha: <40 characters>  # v1.6.0`
   - `changelog:` what's new in this version (10 to 4000 characters, written inline, no file reference)

   Leave `category` alone; later changes to it are ignored.

5. Commit, push and open the pull request:

   ```powershell
   git commit -am "Update io.github.superwolfi82.wakesurf to 1.6.0"
   ```

   ```powershell
   git push -u origin update-wakesurf-1.6.0
   ```

   ```powershell
   gh pr create --repo busy-app/busy-apps-catalog --fill --web
   ```

   `--web` opens the PR form in the browser: fill in the author checklist (tick *I'm the author of the app*,
   otherwise the check fails) and the *AI usage* part, then create the PR.

6. The automatic checks run on the PR; failures are listed there. Fix them with another commit on the same branch
   (editing only the PR text does not rerun the checks). A moderator then reviews, usually within 1–2 business days.
   After the merge the catalog builds the commit from step 2 and publishes it, and bars get the update.

**Optional: check locally before opening the PR** (Python 3.13, run in the catalog folder):

```powershell
python -m pip install -r tools/requirements.txt
```

```powershell
python -m tools.validate_manifest applications/io.github.superwolfi82.wakesurf/manifest.yml
```

This checks the catalog entry only (format, lengths, category). The build itself is checked by the PR.

**Removing the app from the catalog:** a PR that deletes the whole folder `applications/io.github.superwolfi82.wakesurf/`
and nothing else. The ID then stays reserved and cannot be reused without asking the catalog maintainers.

## Where the history is stored

On the bar, in `/ext/apps_data/js_apps/io.github.superwolfi82.wakesurf/wakesurf_timer_history.json`
(inside the app the path is `/ext/data/wakesurf_timer_history.json`). Example entry:

```json
{"n":10,"d":"11/22 17:13","t":9126,"c":12649,"f":1}
```

`t` = surf time in ms, `c` = clock time in ms, `f` = falls. To read it over USB:

```powershell
Invoke-WebRequest "http://10.0.4.20/api/storage/read?path=/ext/apps_data/js_apps/io.github.superwolfi82.wakesurf/wakesurf_timer_history.json" -UseBasicParsing | Select-Object -ExpandProperty Content
```

## App icon

A breaking wave, drawn pixel by pixel:

| Front (8×8, colour) | Back (11×11, grey) |
|---|---|
| ![Front icon](docs/screenshots/icon-front.png) | ![Back icon](docs/screenshots/icon-back.png) |

The pixel maps live in [tools/make-icons.ps1](tools/make-icons.ps1). To change the icon, edit the maps there, then run these two commands and reinstall:

```powershell
.\tools\make-icons.ps1
```

```powershell
.\deploy.ps1
```

## Project files

```
src/
  appmeta/manifest.json         app id, name, version (1.5.0)
  appmeta/icon_front_8x8.png    app icon, front display / app menu
  appmeta/icon_back_11x11.png   app icon, back display
  main.js                       the whole app (plain JavaScript, runs on the bar's JerryScript engine)
package.json, package-lock.json build tool (@busy-app/cli)
deploy.ps1                      build + install + launch over USB
tools/make-icons.ps1            generates the two icon PNGs from pixel maps
.github/workflows/release.yml   on a v* tag: builds the .tgz and attaches it to a GitHub release
dist/                           built package (created by the build, not committed)
screenshots/                    72x16 / 160x80 screenshots for the app catalog
docs/screenshots/               enlarged display screenshots used in this README (taken from the bar)
```

The app only uses the bar's local HTTP API: `display/draw`, `storage/read|write`, `time`.
