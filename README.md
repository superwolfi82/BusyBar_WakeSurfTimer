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


   The front shows `Wakesurf / PRESS START`.
2. **Press START** to begin the session. The display shows `READY` and the number of the next ride.
3. **Rider is up: press START.** The clock runs, the front shows **SURF** in green.
4. **Rider falls: press START.** The clock stops, the front shows **PAUSE** in yellow, the fall counter goes up (`F1`, `F2`, …).
5. **Rider is back up: press START** again to continue the same ride.
6. **Ride is over: press OK.** The ride is saved and the clock goes back to `READY` for the next rider.
   If you finish while paused, that last pause is counted as the end of the ride, not as a fall,
   and the clock time ends at the moment you paused.
7. Repeat 3–6 for every rider.
8. **End the session:** press **BACK** while `READY`, or **hold OK** at any time.
   (Holding OK during a ride saves that ride first.)
9. **Leave the app:** press **BACK** on the start screen.

### All buttons by screen

| Screen | START | OK | Hold OK | BACK | Wheel |
|---|---|---|---|---|---|
| Start screen | start session | open history | – | quit app | open history |
| READY | start ride | open history | end session | end session | open history |
| SURF (riding) | pause (fall) | finish & save ride | save ride, end session | *ignored* | *ignored* |
| PAUSE | resume | finish & save ride | save ride, end session | *ignored* | *ignored* |
| History | close history, start ride | close history | close history | close history | scroll |

BACK and the wheel do nothing while a ride is running, so the clock can't be lost by a stray press.
Rides shorter than 2 seconds are ignored (accidental double press).
Holding BACK always force-quits the app (built into the bar); a running ride is then lost.

### What the displays show

**Front (72×16, colour)**: surf time on the left; state, ride number and falls on the right.

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

Turn the wheel (or press OK on `READY`) to open the history.

- **Front:** surf time of the selected ride, date on top, start time below.
- **Back:** table of 5 rides around the selection: `RIDE  DATE START  SURF  CLOCK  F`.
  The selected ride has a frame; `3/20` at the bottom shows the position.

![Back display: ride history table](docs/screenshots/back-history.png)

*Ride #10 started on 11/22 at 17:13: 9 s surfing, 12 s on the clock, 1 fall.
Rides #8 and older were recorded with version 1.0, so they have no date.
The icons on the right edge belong to the bar itself.*

Turn the wheel to scroll, press OK or BACK to close.
Rides recorded with version 1.0 have no date and show `--/-- --:--`.

### Status light

The LED blinks once on each state change: blue = ready, green = ride started or resumed,
yellow = paused, red = session ended.

### Date and time

The start time comes from the bar's own clock (synced over Wi-Fi, time zone set in the BUSY app).
If the bar's clock is wrong, the ride times are still right but the date/start is off.

---

## Install / update

App installs only work over **USB**: over Wi-Fi the bar refuses them (403 Forbidden).

1. Connect the BUSY Bar to the PC with a USB-C cable (it is then reachable at `10.0.4.20`).
2. In this folder run:

```powershell
.\deploy.ps1
```

This packs `src\app.wakesurf.timer` into `dist\app.wakesurf.timer.tgz`, installs it and starts it.
Your ride history is kept when you update.

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

## Where the history is stored

On the bar, in `/ext/apps_data/js_apps/app.wakesurf.timer/wakesurf_timer_history.json`
(inside the app the path is `/ext/data/wakesurf_timer_history.json`). Example entry:

```json
{"n":10,"d":"11/22 17:13","t":9126,"c":12649,"f":1}
```

`t` = surf time in ms, `c` = clock time in ms, `f` = falls. To read it over USB:

```powershell
Invoke-WebRequest "http://10.0.4.20/api/storage/read?path=/ext/apps_data/js_apps/app.wakesurf.timer/wakesurf_timer_history.json" -UseBasicParsing | Select-Object -ExpandProperty Content
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
src/app.wakesurf.timer/
  appmeta/manifest.json    app id, name, version (1.2.0)
  appmeta/icon_front_8x8.png    app icon, front display / app menu
  appmeta/icon_back_11x11.png   app icon, back display
  scripts/main.js          the whole app (plain JavaScript, runs on the bar's JerryScript engine)
deploy.ps1                 package + install + launch over USB
tools/make-icons.ps1       generates the two icon PNGs from pixel maps
dist/                      built package (created by deploy.ps1)
docs/screenshots/          display screenshots used in this README (taken from the bar)
```

The app only uses the bar's local HTTP API: `display/draw`, `storage/read|write`, `time`.
No Node.js or other tools are needed on the PC.
