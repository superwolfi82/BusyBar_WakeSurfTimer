// Wakesurf Timer for BUSY Bar
// Ride timer for boat captains (wakesurf / wakeboard / waterski).
//
// Controls
//   START  short : start session -> start ride -> pause (fall) -> resume
//   START  long  : finish current ride (saved to history)
//   OK     short : finish current ride too / open-close history
//   OK     long  : end the session
//   BACK   short : close history / end session (when no ride is running) / quit app
//   ENCODER      : scroll history (opens it when no ride is running)
//
// Each ride records:
//   surf time  - time the rider was actually up (pauses excluded)
//   clock time - wall time from ride start to ride end (pauses included)

var APP = "io.github.superwolfi82.wakesurf";
var API = "http://localhost/api/";
// JS apps are sandboxed: /ext/data maps to /ext/apps_data/js_apps/<app id>/
var HISTORY_PATH = "/ext/data/wakesurf_timer_history.json";
var HISTORY_MAX = 20;
var MIN_RIDE_MS = 2000;

// the firmware draws status icons (wifi, sound, usb, battery) in the right ~12px of the
// back display, so our usable area there is x 0..147
var BACK_RIGHT = 146;
var BACK_MID = 74;

var C_WHITE = "#FFFFFFFF";
var C_GREY = "#888888FF";
var C_BLUE = "#3FA9FFFF";
var C_GREEN = "#33DD55FF";
var C_YELLOW = "#FFC400FF";
var C_RED = "#FF4040FF";
var C_CYAN = "#55E0E0FF";
var C_BACK_DIM = "#AAAAAAFF";

// ---- state -----------------------------------------------------------------

var S_IDLE = "idle";       // no session
var S_READY = "ready";     // session running, waiting for next rider
var S_RIDING = "riding";   // clock running
var S_PAUSED = "paused";   // surfer fell / rope dropped, clock frozen

var state = S_IDLE;
var view = "timer";        // "timer" | "history"
var histIndex = 0;
var histPage = 0;          // front top row in history: 0 = ride number, 1 = start date/time
var histTimer = null;
var HIST_PAGE_MS = 2000;

var sessionStart = 0;      // ms
var rideStart = 0;         // ms when START was first pressed for this ride
var rideStamp = null;      // "MM/DD HH:MM" local start time of this ride
var rideAccum = 0;         // ms of riding before the current run segment
var segStart = 0;          // ms when the current run segment started
var pausedAt = 0;          // ms when the current pause began
var falls = 0;             // pauses in the current ride

// history: newest first, entries {n: rideNo, d: "MM/DD HH:MM", t: surf ms, c: clock ms, f: falls}
var history = [];
var nextRideNo = 1;

// wall clock: local time from /api/time, anchored to Date.now()
var wallBase = null;       // {ms: local time as UTC ms, at: Date.now() when read}

var tickTimer = null;
var unbind = null;

function now() {
    return Date.now();
}

function rideMs() {
    if (state === S_RIDING) return rideAccum + (now() - segStart);
    return rideAccum;
}

function clockMs() {
    if (state === S_RIDING) return now() - rideStart;
    if (state === S_PAUSED) return now() - rideStart;
    return 0;
}

// ---- formatting --------------------------------------------------------------

function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
}

function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ":" + pad2(m) + ":" + pad2(sec);
    return pad2(m) + ":" + pad2(sec);
}

// ---- wall clock ----------------------------------------------------------------

// "2026-11-22T17:10:54+01:00" -> local time as a UTC-based ms value
function parseLocal(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function syncWallClock() {
    return api("time").then(function (res) {
        if (!res.ok || !res.text) return;
        try {
            var ms = parseLocal(JSON.parse(res.text).timestamp || "");
            if (ms !== null) wallBase = { ms: ms, at: now() };
        } catch (e) {
            console.log("time parse failed: " + String(e));
        }
    });
}

function stampAt(t) {
    if (!wallBase) return null;
    var d = new Date(wallBase.ms + (t - wallBase.at));
    return pad2(d.getUTCMonth() + 1) + "/" + pad2(d.getUTCDate()) + " " +
        pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
}

// ---- HTTP --------------------------------------------------------------------
//
// All requests to the bar go through one queue: only one fetch is in flight at a time and
// each response body is read completely before the next request starts. Overlapping
// fetches (e.g. saving the history while the screen redraws) crashed the JS engine with
// "jerryscript fatal error 120" on firmware 1.4.1.

var apiQueue = Promise.resolve();

function api(path, opts) {
    var p = apiQueue.then(function () {
        return fetch(API + path, opts || {}).then(function (r) {
            return r.text().then(
                function (t) { return { ok: r.ok, status: r.status, text: t }; },
                function () { return { ok: r.ok, status: r.status, text: "" }; }
            );
        });
    }).catch(function (e) {
        console.log("api " + path + " failed: " + String(e));
        return { ok: false, status: 0, text: "" };
    });
    apiQueue = p;
    return p;
}

// ---- persistence -------------------------------------------------------------

function loadHistory() {
    return api("storage/read?path=" + HISTORY_PATH).then(function (res) {
        if (!res.ok || !res.text) return;
        try {
            var data = JSON.parse(res.text);
            if (data && data.rides && data.rides.length !== undefined) {
                history = data.rides.slice(0, HISTORY_MAX);
                nextRideNo = data.next || (history.length ? history[0].n + 1 : 1);
            }
        } catch (e) {
            console.log("history parse failed: " + String(e));
        }
    });
}

function saveHistory() {
    return api("storage/write?path=" + HISTORY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: JSON.stringify({ next: nextRideNo, rides: history })
    }).then(function (res) {
        if (!res.ok) console.log("history save failed: " + res.status + " " + res.text);
    });
}

// ---- drawing -------------------------------------------------------------------

function text(id, display, x, y, align, txt, font, color) {
    // the back display is greyscale: colours turn into dim greys, so keep it high-contrast
    if (display === "back") color = color === C_GREY ? C_BACK_DIM : C_WHITE;
    return {
        id: id, type: "text", display: display,
        x: x, y: y, align: align, z_index: 1,
        text: txt, font: font, color: color || C_WHITE
    };
}

function stateColor() {
    if (state === S_RIDING) return C_GREEN;
    if (state === S_PAUSED) return C_YELLOW;
    return C_BLUE;
}

function lastRidesLine() {
    if (!history.length) return "No rides yet";
    var parts = [];
    for (var i = 0; i < history.length && i < 4; i++) parts.push(fmt(history[i].t));
    return "Last: " + parts.join("  ");
}

function buildIdle() {
    var el = [];
    el.push(text("f0", "front", 36, 0, "top_mid", "Wakesurf", "small", C_WHITE));
    el.push(text("f1", "front", 36, 16, "bottom_mid", "PRESS START", "tiny", C_BLUE));

    el.push(text("b0", "back", BACK_MID, 2, "top_mid", "WAKESURF TIMER", "bold", C_WHITE));
    el.push(text("b1", "back", BACK_MID, 24, "top_mid", "START  new session", "small", C_WHITE));
    el.push(text("b2", "back", BACK_MID, 36, "top_mid", "ROTATE  ride history", "small", C_GREY));
    el.push(text("b3", "back", BACK_MID, 48, "top_mid", "BACK  quit", "small", C_GREY));
    el.push(text("b4", "back", 4, 79, "bottom_left", lastRidesLine(), "small", C_WHITE));
    return el;
}

function buildSession() {
    var el = [];
    var t = fmt(rideMs());
    var col = stateColor();
    var label = state === S_RIDING ? "SURF" : state === S_PAUSED ? "PAUSE" : "READY";
    var timeCol = state === S_READY ? C_GREY : (state === S_PAUSED ? C_YELLOW : C_WHITE);
    var sub = "#" + nextRideNo + (falls > 0 ? " F" + falls : "");

    // front 72x16
    el.push(text("f0", "front", 1, 8, "mid_left", t, "large", timeCol));
    el.push(text("f1", "front", 71, 0, "top_right", label, "bold", col));
    el.push(text("f2", "front", 71, 16, "bottom_right", sub, "tiny", C_GREY));

    // back 160x80
    var stateLine, info, hint;
    if (state === S_RIDING) {
        stateLine = "RIDING";
        info = "CLOCK " + fmt(clockMs()) + "   FALLS " + falls;
        hint = "START: PAUSE    HOLD START: FINISH";
    } else if (state === S_PAUSED) {
        stateLine = "PAUSED";
        info = "CLOCK " + fmt(clockMs()) + "   FALLS " + falls;
        hint = "START: RESUME   HOLD START: FINISH";
    } else {
        stateLine = "READY FOR RIDER";
        info = history.length
            ? "LAST #" + history[0].n + "  SURF " + fmt(history[0].t) + "  CLOCK " + fmt(history[0].c || history[0].t)
            : "Press START when the rider is up";
        hint = "START: GO   ROTATE: HISTORY   BACK: END";
    }
    el.push(text("b0", "back", 4, 2, "top_left", "RIDE #" + nextRideNo, "small", C_WHITE));
    el.push(text("b1", "back", BACK_RIGHT, 2, "top_right",
        "SESSION " + fmt(now() - sessionStart), "small", C_GREY));
    el.push(text("b2", "back", BACK_MID, 24, "center", t, "extra_large", timeCol));
    el.push(text("b3", "back", BACK_MID, 34, "top_mid", stateLine, "normal", col));
    el.push(text("b4", "back", BACK_MID, 48, "top_mid", info, "small", C_WHITE));
    el.push(text("b5", "back", BACK_MID, 61, "top_mid", hint, "tiny", C_GREY));
    el.push(text("b6", "back", 4, 79, "bottom_left", lastRidesLine(), "small", C_WHITE));
    return el;
}

// history table columns on the back display
var COL_NO = 4, COL_DATE = 24, COL_SURF = 78, COL_CLOCK = 106;
var ROWS = 5, ROW_Y0 = 10, ROW_H = 11;

function buildHistory() {
    var el = [];
    if (!history.length) {
        el.push(text("f0", "front", 36, 8, "center", "NO RIDES", "normal", C_GREY));
        el.push(text("b0", "back", BACK_MID, 2, "top_mid", "RIDE HISTORY", "bold", C_WHITE));
        el.push(text("b1", "back", BACK_MID, 40, "center", "No rides yet", "normal", C_GREY));
        return el;
    }
    var e = history[histIndex];

    // front 72x16: two rows in the 7-dot "normal" font (6 px per character).
    // Its text box has 2 px padding above and below the glyphs, hence y -2 and 7:
    // glyph rows 0-6 and 9-15. Everything at once would be ~85 px wide, so the top
    // row alternates between ride number and start date/time; surf | clock stay put.
    var first = histPage === 0;
    el.push(text("f0", "front", first ? 0 : 71, -2, first ? "top_left" : "top_right",
        first ? "RIDE #" + e.n : (e.d || "--/-- --:--"), "normal", first ? C_WHITE : C_YELLOW));
    el.push(text("f1", "front", 0, 7, "top_left", fmt(e.t), "normal", C_CYAN));
    el.push(text("f2", "front", 71, 7, "top_right", fmt(e.c || e.t), "normal", C_BLUE));

    // back: table, 5 rows around the selection
    el.push(text("h0", "back", COL_NO, 1, "top_left", "RIDE", "tiny", C_GREY));
    el.push(text("h1", "back", COL_DATE, 1, "top_left", "DATE  START", "tiny", C_GREY));
    el.push(text("h2", "back", COL_SURF, 1, "top_left", "SURF", "tiny", C_GREY));
    el.push(text("h3", "back", COL_CLOCK, 1, "top_left", "CLOCK", "tiny", C_GREY));
    el.push(text("h4", "back", BACK_RIGHT, 1, "top_right", "F", "tiny", C_GREY));

    var first = Math.max(0, Math.min(histIndex - 2, history.length - ROWS));
    for (var i = 0; i < ROWS && first + i < history.length; i++) {
        var k = first + i;
        var h = history[k];
        var y = ROW_Y0 + i * ROW_H;
        if (k === histIndex) {
            el.push({
                id: "sel", type: "rectangle", display: "back",
                x: 1, y: y - 2, width: BACK_RIGHT + 1, height: ROW_H + 1, radius: 2,
                fill: "none", border_width: 1, border_color: C_WHITE, z_index: 0
            });
        }
        var r = "r" + i;
        el.push(text(r + "n", "back", COL_NO, y, "top_left", "#" + h.n, "small", C_WHITE));
        el.push(text(r + "d", "back", COL_DATE, y, "top_left", h.d || "--/-- --:--", "small", C_WHITE));
        el.push(text(r + "s", "back", COL_SURF, y, "top_left", fmt(h.t), "small", C_WHITE));
        el.push(text(r + "c", "back", COL_CLOCK, y, "top_left", fmt(h.c || h.t), "small", C_WHITE));
        el.push(text(r + "f", "back", BACK_RIGHT, y, "top_right", "" + h.f, "small", C_WHITE));
    }
    el.push(text("hint", "back", BACK_MID, 79, "bottom_mid",
        "ROTATE: SCROLL  BACK: CLOSE  " + (histIndex + 1) + "/" + history.length,
        "tiny", C_GREY));
    return el;
}

var drawing = false;
var drawPending = false;
var pendingLed = null;

function render(ledColor) {
    if (ledColor) pendingLed = ledColor;
    if (drawing) {
        drawPending = true;
        return;
    }
    drawing = true;

    var elements;
    if (view === "history") elements = buildHistory();
    else if (state === S_IDLE) elements = buildIdle();
    else elements = buildSession();

    // a draw POST replaces everything this app had on screen, so elements of the
    // previous view disappear without a separate DELETE
    var payload = { application_name: APP, elements: elements };
    if (pendingLed) {
        payload.led_notification_color = pendingLed;
        pendingLed = null;
    }

    api("display/draw", { method: "POST", body: JSON.stringify(payload) }).then(function (res) {
        if (!res.ok) console.log("draw failed: " + res.status + " " + res.text);
        drawing = false;
        if (drawPending) {
            drawPending = false;
            render();
        }
    });
}

// ---- clock -----------------------------------------------------------------------

function scheduleTick() {
    stopTick();
    if (state === S_IDLE) return;
    // align to the next full second of the ride clock so the display steps evenly
    var delay = state === S_RIDING ? 1000 - (rideMs() % 1000) : 1000;
    tickTimer = setTimeout(function () {
        tickTimer = null;
        if (view === "timer") render();
        scheduleTick();
    }, delay + 5);
}

function stopTick() {
    if (tickTimer !== null) {
        clearTimeout(tickTimer);
        tickTimer = null;
    }
}

// ---- actions ----------------------------------------------------------------------

function startSession() {
    state = S_READY;
    sessionStart = now();
    resetRide();
    view = "timer";
    syncWallClock();
    render(C_BLUE);
    scheduleTick();
}

function resetRide() {
    rideStart = 0;
    rideStamp = null;
    rideAccum = 0;
    segStart = 0;
    pausedAt = 0;
    falls = 0;
}

function startOrResume() {
    var t = now();
    if (state === S_READY) {
        rideStart = t;
        rideStamp = stampAt(t);
    }
    segStart = t;
    state = S_RIDING;
    render(C_GREEN);
    scheduleTick();
}

function pause() {
    var t = now();
    rideAccum += t - segStart;
    pausedAt = t;
    falls += 1;
    state = S_PAUSED;
    render(C_YELLOW);
    scheduleTick();
}

function finishRide() {
    var t = now();
    var f = falls;
    var end = t;
    if (state === S_RIDING) {
        rideAccum += t - segStart;
    } else if (state === S_PAUSED) {
        // the last pause was the end of the ride, not a fall
        f = Math.max(0, falls - 1);
        end = pausedAt;
    }
    var ms = rideAccum;
    if (ms >= MIN_RIDE_MS) {
        history.unshift({
            n: nextRideNo,
            d: rideStamp || stampAt(rideStart),
            t: ms,
            c: Math.max(ms, end - rideStart),
            f: f
        });
        if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
        nextRideNo += 1;
        saveHistory();
    }
    state = S_READY;
    resetRide();
    render(C_BLUE);
    scheduleTick();
}

function endSession() {
    if (state === S_RIDING || state === S_PAUSED) finishRide();
    state = S_IDLE;
    view = "timer";
    stopTick();
    render(C_RED);
}

// flip the front top row between ride number and start date/time
function restartHistPages() {
    stopHistPages();
    histPage = 0;
    histTimer = setTimeout(function flip() {
        if (view !== "history") {
            histTimer = null;
            return;
        }
        histPage = 1 - histPage;
        render();
        histTimer = setTimeout(flip, HIST_PAGE_MS);
    }, HIST_PAGE_MS);
}

function stopHistPages() {
    if (histTimer !== null) {
        clearTimeout(histTimer);
        histTimer = null;
    }
}

function openHistory() {
    view = "history";
    histIndex = 0;
    restartHistPages();
    render();
}

function closeHistory() {
    view = "timer";
    stopHistPages();
    render();
}

function quit() {
    stopTick();
    stopHistPages();
    if (unbind) unbind();
    unbind = null;
    api("display/draw?application_name=" + APP, { method: "DELETE" });
}

// ---- input -------------------------------------------------------------------------

function onInput(ev) {
    if (ev.key === "encoder") {
        if (state === S_RIDING || state === S_PAUSED) return; // never leave a running clock
        if (view !== "history") {
            openHistory();
            return;
        }
        if (history.length) {
            histIndex = Math.max(0, Math.min(history.length - 1, histIndex + (ev.delta || 0)));
            restartHistPages(); // show the new ride's number first
            render();
        }
        return;
    }

    if (ev.action !== "short" && ev.action !== "long") return;

    if (view === "history") {
        if (ev.key === "ok" || ev.key === "back") closeHistory();
        else if (ev.key === "start" && ev.action === "short") {
            view = "timer";
            stopHistPages();
            if (state === S_IDLE) startSession();
            else startOrResume();
        }
        return;
    }

    if (ev.key === "start" && ev.action === "short") {
        if (state === S_IDLE) startSession();
        else if (state === S_READY || state === S_PAUSED) startOrResume();
        else if (state === S_RIDING) pause();
        return;
    }

    // Hold START = finish the ride. OK does the same, but on a bar connected to Home Assistant
    // the BUSY Bar integration also reacts to OK and covers the screen with its dashboard.
    if (ev.key === "start" && ev.action === "long") {
        console.log("input start long, state " + state);
        if (state === S_RIDING || state === S_PAUSED) finishRide();
        return;
    }

    if (ev.key === "ok") {
        if (ev.action === "long") {
            if (state !== S_IDLE) endSession();
            return;
        }
        if (state === S_RIDING || state === S_PAUSED) finishRide();
        else openHistory();
        return;
    }

    if (ev.key === "back" && ev.action === "short") {
        if (state === S_IDLE) quit();
        else if (state === S_READY) endSession();
        // while a ride is running BACK is ignored so the clock can't be lost by accident
    }
}

// ---- boot ---------------------------------------------------------------------------

unbind = listen("input", onInput);
render();
syncWallClock();
loadHistory().then(function () { render(); });
