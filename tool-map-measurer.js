// tool-map-measurer.js
// Map distance measuring tool: upload a map, calibrate scale, measure distances, estimate travel time.
// No external dependencies.

(function () {
  "use strict";

  const TOOL_ID = "mapMeasurer";
  const TOOL_NAME = "Map Measure";
  const PANEL_CLASS = "map-measurer-panel";
  const LS_KEY = "vrahuneMapMeasurerV1";

  const UNIT_OPTIONS = [
    { id: "mi", label: "Miles" },
    { id: "km", label: "Kilometers" },
    { id: "ft", label: "Feet" },
    { id: "m", label: "Meters" },
  ];

  const TRAVEL_PRESETS = [
    { id: "footSlow", name: "On foot (slow)", mph: 2, hoursPerDay: 8, note: "≈16 mi/day" },
    { id: "footNormal", name: "On foot (normal)", mph: 3, hoursPerDay: 8, note: "≈24 mi/day" },
    { id: "footFast", name: "On foot (fast)", mph: 4, hoursPerDay: 8, note: "≈32 mi/day" },
    { id: "horse", name: "Horse (steady)", mph: 6, hoursPerDay: 8, note: "≈48 mi/day" },
    { id: "wagon", name: "Wagon/Caravan", mph: 2.5, hoursPerDay: 8, note: "≈20 mi/day" },
    { id: "ship", name: "Ship/Sailing", mph: 4, hoursPerDay: 24, note: "continuous travel" },
    { id: "airship", name: "Airship", mph: 10, hoursPerDay: 24, note: "continuous travel" },
    { id: "custom", name: "Custom", mph: 3, hoursPerDay: 8, note: "" },
  ];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function toNumber(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function round(n, places = 2) {
    const p = Math.pow(10, places);
    return Math.round(n * p) / p;
  }

  function unitLabel(unitId) {
    const u = UNIT_OPTIONS.find(x => x.id === unitId);
    return u ? u.label : unitId;
  }

  // Convert a distance in the given unit to miles.
  function toMiles(dist, unitId) {
    const d = Number(dist) || 0;
    switch (unitId) {
      case "mi": return d;
      case "km": return d * 0.621371;
      case "ft": return d / 5280;
      case "m":  return d / 1609.344;
      default: return d;
    }
  }

  // Convert miles to the given unit.
  function fromMiles(mi, unitId) {
    const d = Number(mi) || 0;
    switch (unitId) {
      case "mi": return d;
      case "km": return d / 0.621371;
      case "ft": return d * 5280;
      case "m":  return d * 1609.344;
      default: return d;
    }
  }

  function fmtDuration(totalHours, hoursPerDay) {
    const hpd = Math.max(1, Number(hoursPerDay) || 8);
    const days = totalHours / hpd;
    const wholeDays = Math.floor(days);
    const remHours = (days - wholeDays) * hpd;
    if (wholeDays <= 0) return `${round(totalHours, 2)} hr`;
    const hrRounded = round(remHours, 2);
    return `${wholeDays} day${wholeDays !== 1 ? "s" : ""}${hrRounded > 0 ? ` ${hrRounded} hr` : ""}`;
  }

  function defaultState() {
    return {
      mode: "measure", // "measure" | "calibrate"
      panEnabled: false,
      unit: "mi",
      knownDistance: 1,
      unitsPerPixel: null, // derived from calibration
      // points are in image-space coordinates (not screen)
      scalePts: [],
      pathPts: [],
      travelPresetId: "footNormal",
      customMph: 3,
      customHoursPerDay: 8,
      // view transform
      view: { zoom: 1, panX: 0, panY: 0 },
      // image
      imageDataUrl: null, // optional; not persisted by default to avoid huge storage
      imageName: "",
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const s = { ...defaultState(), ...(parsed || {}) };
      // Don't persist large images unless user explicitly wants it (we keep null)
      s.imageDataUrl = null;
      s.scalePts = Array.isArray(s.scalePts) ? s.scalePts : [];
      s.pathPts = Array.isArray(s.pathPts) ? s.pathPts : [];
      if (!s.view) s.view = { zoom: 1, panX: 0, panY: 0 };
      return s;
    } catch (e) {
      console.warn("Map Measure: failed to load state", e);
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      const s = { ...state };
      // Avoid storing potentially huge images
      s.imageDataUrl = null;
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch (e) {
      // ignore
    }
  }

  let _ctx = null;
  let _state = loadState();
  let _img = new Image();
  let _imgReady = false;

  function setCtx(ctx) { _ctx = ctx; }
  function panelEl() { return _ctx ? _ctx.panelEl : null; }
  function labelEl() { return _ctx ? _ctx.labelEl : null; }

  function getTravelPreset(id) {
    return TRAVEL_PRESETS.find(p => p.id === id) || TRAVEL_PRESETS[1];
  }

  function getTravelConfig(state) {
    const preset = getTravelPreset(state.travelPresetId);
    if (preset.id !== "custom") return preset;
    return {
      ...preset,
      mph: toNumber(state.customMph, 3),
      hoursPerDay: toNumber(state.customHoursPerDay, 8),
    };
  }

  function clearMeasurements(state) {
    state.scalePts = [];
    state.pathPts = [];
  }

  function resetViewToFit(state, canvas) {
    if (!_imgReady || !canvas) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = _img.naturalWidth || _img.width || 1;
    const ih = _img.naturalHeight || _img.height || 1;

    const pad = 20;
    const zx = (cw - pad * 2) / iw;
    const zy = (ch - pad * 2) / ih;
    const z = clamp(Math.min(zx, zy), 0.05, 10);

    state.view.zoom = z;
    state.view.panX = (cw - iw * z) / 2;
    state.view.panY = (ch - ih * z) / 2;
  }

  function screenToImage(state, sx, sy) {
    const z = state.view.zoom || 1;
    const ix = (sx - (state.view.panX || 0)) / z;
    const iy = (sy - (state.view.panY || 0)) / z;
    return { x: ix, y: iy };
  }

  function imageToScreen(state, ix, iy) {
    const z = state.view.zoom || 1;
    const sx = ix * z + (state.view.panX || 0);
    const sy = iy * z + (state.view.panY || 0);
    return { x: sx, y: sy };
  }

  function distPts(a, b) {
    const dx = (a.x - b.x);
    const dy = (a.y - b.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function sumPathPixels(state) {
    const pts = state.pathPts || [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += distPts(pts[i - 1], pts[i]);
    return total;
  }

  function calibrationPixels(state) {
    const pts = state.scalePts || [];
    if (pts.length !== 2) return null;
    return distPts(pts[0], pts[1]);
  }

  function calcDistance(state) {
    const unitsPerPx = state.unitsPerPixel;
    if (!unitsPerPx) return { distance: 0, unit: state.unit };
    const px = sumPathPixels(state);
    return { distance: px * unitsPerPx, unit: state.unit };
  }

  function calcScaleFromKnown(state) {
    const px = calibrationPixels(state);
    if (!px || px <= 0) return null;
    const known = toNumber(state.knownDistance, 1);
    if (!known || known <= 0) return null;
    return known / px;
  }

  function drawCanvas(state, canvas, overlayEl) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crispness
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      // If we resized, refit view (but only if no manual panning yet)
      if (state._touchedView !== true) resetViewToFit(state, canvas);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw map
    if (_imgReady) {
      ctx.save();
      ctx.translate(state.view.panX || 0, state.view.panY || 0);
      ctx.scale(state.view.zoom || 1, state.view.zoom || 1);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(_img, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(219,228,255,0.8)";
      ctx.font = `${14 * (window.devicePixelRatio || 1)}px system-ui, sans-serif`;
      ctx.fillText("Upload a map image to begin.", 16, 24);
    }

    // Helpers
    function drawPoint(pt, color, radius = 4) {
      const s = imageToScreen(state, pt.x, pt.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius * (window.devicePixelRatio || 1), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    function drawPath(pts, color, width = 2) {
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      const s0 = imageToScreen(state, pts[0].x, pts[0].y);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        const si = imageToScreen(state, pts[i].x, pts[i].y);
        ctx.lineTo(si.x, si.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width * (window.devicePixelRatio || 1);
      ctx.stroke();
    }

    // Draw calibration line
    if (state.scalePts && state.scalePts.length) {
      drawPath(state.scalePts, "rgba(120,190,255,0.95)", 2);
      for (const p of state.scalePts) drawPoint(p, "rgba(120,190,255,0.95)", 4);
    }

    // Draw measurement path
    if (state.pathPts && state.pathPts.length) {
      drawPath(state.pathPts, "rgba(255,210,120,0.95)", 2);
      for (const p of state.pathPts) drawPoint(p, "rgba(255,210,120,0.95)", 3);
    }

    // Overlay stats
    if (overlayEl) {
      const scalePx = calibrationPixels(state);
      const unitsPerPx = state.unitsPerPixel;
      const distObj = calcDistance(state);
      const dist = distObj.distance || 0;

      const travel = getTravelConfig(state);
      const distMiles = toMiles(dist, state.unit);
      const hours = travel.mph > 0 ? (distMiles / travel.mph) : 0;

      overlayEl.innerHTML = `
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <div><span class="muted">Mode:</span> <b>${state.mode === "calibrate" ? "Calibrate" : "Measure"}</b></div>
          <div><span class="muted">Scale:</span> <b>${unitsPerPx ? `${round(unitsPerPx, 6)} ${state.unit}/px` : "not set"}</b></div>
          <div><span class="muted">Path:</span> <b>${unitsPerPx ? `${round(dist, 2)} ${state.unit}` : `${round(sumPathPixels(state), 2)} px`}</b></div>
          <div><span class="muted">Travel:</span> <b>${travel.name}</b> <span class="muted">(${travel.mph} mph, ${travel.hoursPerDay} hr/day)</span></div>
          <div><span class="muted">Time:</span> <b>${unitsPerPx ? fmtDuration(hours, travel.hoursPerDay) : "set scale first"}</b></div>
        </div>
        <div class="muted" style="margin-top:4px;">
          Tips: Left-click to add points · Right-drag (or toggle Pan) to pan · Mouse wheel to zoom · Backspace removes last point
        </div>
      `;

      // Show calibration hint
      if (state.mode === "calibrate") {
        const hint = (state.scalePts || []).length < 2
          ? "Click two points to define a known distance."
          : (scalePx ? `Calibration line: ${round(scalePx, 2)} px` : "");
        if (hint) {
          overlayEl.innerHTML += `<div class="muted" style="margin-top:6px;">${hint}</div>`;
        }
      }
    }
  }

  function render(ctx) {
    setCtx(ctx);
    const panel = panelEl();
    const label = labelEl();
    if (!panel || !label) return;
    label.textContent = TOOL_NAME;

    // Clean panel class from other tools, apply ours
    panel.classList.remove("encounter-tool-panel", "statblock-importer-panel", "mv-panel");
    panel.classList.add(PANEL_CLASS);

    const travel = getTravelConfig(_state);

    panel.innerHTML = `
      <style>
        .${PANEL_CLASS} .mm-root { display:flex; flex-direction:column; gap:10px; color:#dbe4ff; }
        .${PANEL_CLASS} .mm-top { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
        .${PANEL_CLASS} .mm-card { border:1px solid #222832; border-radius:12px; background:#05070c; padding:10px; }
        .${PANEL_CLASS} .mm-canvas-wrap { position:relative; border:1px solid #222832; border-radius:12px; overflow:hidden; background:#05070c; }
        .${PANEL_CLASS} canvas { width:100%; height:520px; display:block; cursor: crosshair; }
        .${PANEL_CLASS} .mm-overlay { padding:8px 10px; border-top:1px solid #222832; background: radial-gradient(circle at top left, #10151f, #05070c 70%); }
        .${PANEL_CLASS} .mm-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid #222832; border-radius:999px; background:#070a12; font-size:0.78rem; }
        .${PANEL_CLASS} .mm-split { display:flex; gap:10px; flex-wrap:wrap; }
        .${PANEL_CLASS} .mm-split .mm-card { flex: 1 1 280px; min-width: 260px; }
        .${PANEL_CLASS} .mm-row { display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; }
        .${PANEL_CLASS} .mm-row .col { flex:1 1 180px; min-width: 160px; }
        .${PANEL_CLASS} .mm-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .${PANEL_CLASS} .mm-muted { color:#9aa2af; font-size:0.78rem; }
        .${PANEL_CLASS} .mm-small { font-size:0.78rem; }
      </style>

      <div class="mm-root">
        <div class="mm-split">
          <div class="mm-card">
            <div class="mm-row">
              <div class="col">
                <label>Upload map image</label>
                <input id="mmFile" type="file" accept="image/*" />
                <div class="mm-muted" id="mmFileName">${_state.imageName ? `Loaded: <b>${_state.imageName}</b>` : "No image loaded yet."}</div>
              </div>

              <div class="col" style="min-width:180px;">
                <label>Mode</label>
                <div class="mm-actions">
                  <button id="mmModeMeasure" class="btn-secondary btn-small" type="button">Measure</button>
                  <button id="mmModeCal" class="btn-secondary btn-small" type="button">Calibrate</button>
                  <button id="mmTogglePan" class="btn-secondary btn-small" type="button">Pan: ${_state.panEnabled ? "On" : "Off"}</button>
                </div>
              </div>

              <div class="col" style="min-width:220px;">
                <label>Quick actions</label>
                <div class="mm-actions">
                  <button id="mmClearPath" class="btn-secondary btn-small" type="button">Clear path</button>
                  <button id="mmClearScale" class="btn-secondary btn-small" type="button">Clear scale</button>
                  <button id="mmResetView" class="btn-secondary btn-small" type="button">Fit view</button>
                </div>
              </div>
            </div>
          </div>

          <div class="mm-card">
            <div class="mm-row">
              <div class="col">
                <label>Distance unit</label>
                <select id="mmUnit">
                  ${UNIT_OPTIONS.map(u => `<option value="${u.id}" ${u.id === _state.unit ? "selected" : ""}>${u.label}</option>`).join("")}
                </select>
              </div>
              <div class="col">
                <label>Known distance (for calibration)</label>
                <input id="mmKnown" type="number" min="0" step="0.01" value="${_state.knownDistance ?? 1}" />
              </div>
              <div class="col" style="min-width:220px;">
                <label>Set scale</label>
                <div class="mm-actions">
                  <button id="mmApplyScale" class="btn-primary btn-small" type="button">Apply from line</button>
                  <button id="mmNudgeScale" class="btn-secondary btn-small" type="button">Recompute</button>
                </div>
                <div class="mm-muted" id="mmScaleStatus"></div>
              </div>
            </div>

            <div class="mm-row" style="margin-top:10px;">
              <div class="col">
                <label>Travel method</label>
                <select id="mmTravel">
                  ${TRAVEL_PRESETS.map(p => `<option value="${p.id}" ${p.id === _state.travelPresetId ? "selected" : ""}>${p.name}${p.note ? ` — ${p.note}` : ""}</option>`).join("")}
                </select>
              </div>

              <div class="col" id="mmCustomWrap" style="display:${_state.travelPresetId === "custom" ? "block" : "none"};">
                <label>Custom speed (mph)</label>
                <input id="mmCustomMph" type="number" min="0" step="0.1" value="${_state.customMph ?? 3}" />
              </div>

              <div class="col" id="mmCustomWrap2" style="display:${_state.travelPresetId === "custom" ? "block" : "none"};">
                <label>Travel hours per day</label>
                <input id="mmCustomHpd" type="number" min="1" step="1" value="${_state.customHoursPerDay ?? 8}" />
              </div>
            </div>

            <div class="mm-muted" style="margin-top:8px;">
              Calibrate by clicking two points (Calibrate mode), entering the real distance, and clicking <b>Apply from line</b>.
              Then switch to Measure mode to click a route.
            </div>
          </div>
        </div>

        <div class="mm-canvas-wrap">
          <canvas id="mmCanvas"></canvas>
          <div id="mmOverlay" class="mm-overlay"></div>
        </div>
      </div>
    `;

    // Wire UI
    const $ = (sel) => panel.querySelector(sel);

    const fileEl = $("#mmFile");
    const canvas = $("#mmCanvas");
    const overlay = $("#mmOverlay");

    // Buttons
    $("#mmModeMeasure")?.addEventListener("click", () => { _state.mode = "measure"; saveState(_state); drawCanvas(_state, canvas, overlay); });
    $("#mmModeCal")?.addEventListener("click", () => { _state.mode = "calibrate"; saveState(_state); drawCanvas(_state, canvas, overlay); });
    $("#mmTogglePan")?.addEventListener("click", () => { _state.panEnabled = !_state.panEnabled; saveState(_state); render(_ctx); });

    $("#mmClearPath")?.addEventListener("click", () => { _state.pathPts = []; saveState(_state); drawCanvas(_state, canvas, overlay); });
    $("#mmClearScale")?.addEventListener("click", () => { _state.scalePts = []; _state.unitsPerPixel = null; saveState(_state); drawCanvas(_state, canvas, overlay); renderScaleStatus(panel); });
    $("#mmResetView")?.addEventListener("click", () => { resetViewToFit(_state, canvas); _state._touchedView = true; saveState(_state); drawCanvas(_state, canvas, overlay); });

    $("#mmUnit")?.addEventListener("change", (e) => {
      _state.unit = e.target.value || "mi";
      // if scale was set previously, it implicitly changes meaning; clear scale to avoid nonsense
      _state.unitsPerPixel = null;
      _state.scalePts = [];
      saveState(_state);
      render(_ctx);
    });

    $("#mmKnown")?.addEventListener("input", (e) => {
      _state.knownDistance = toNumber(e.target.value, 1);
      saveState(_state);
      renderScaleStatus(panel);
      drawCanvas(_state, canvas, overlay);
    });

    $("#mmTravel")?.addEventListener("change", (e) => {
      _state.travelPresetId = e.target.value || "footNormal";
      saveState(_state);
      render(_ctx);
    });

    $("#mmCustomMph")?.addEventListener("input", (e) => {
      _state.customMph = toNumber(e.target.value, 3);
      saveState(_state);
      drawCanvas(_state, canvas, overlay);
    });

    $("#mmCustomHpd")?.addEventListener("input", (e) => {
      _state.customHoursPerDay = toNumber(e.target.value, 8);
      saveState(_state);
      drawCanvas(_state, canvas, overlay);
    });

    $("#mmApplyScale")?.addEventListener("click", () => {
      const upx = calcScaleFromKnown(_state);
      if (!upx) {
        window.alert("Calibration needs two points and a positive known distance.");
        return;
      }
      _state.unitsPerPixel = upx;
      saveState(_state);
      renderScaleStatus(panel);
      drawCanvas(_state, canvas, overlay);
    });

    $("#mmNudgeScale")?.addEventListener("click", () => {
      // Recompute scale without changing points (useful after editing known distance)
      const upx = calcScaleFromKnown(_state);
      if (!upx) return;
      _state.unitsPerPixel = upx;
      saveState(_state);
      renderScaleStatus(panel);
      drawCanvas(_state, canvas, overlay);
    });

    // File load
    if (fileEl) {
      fileEl.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          _state.imageName = file.name || "map";
          _imgReady = false;
          _img = new Image();
          _img.onload = () => {
            _imgReady = true;
            // fit view
            resetViewToFit(_state, canvas);
            _state._touchedView = true;
            saveState(_state);
            drawCanvas(_state, canvas, overlay);
            renderScaleStatus(panel);
          };
          _img.src = String(reader.result || "");
          // Don't persist image by default
        };
        reader.readAsDataURL(file);
      });
    }

    // Canvas interactions (Pointer Events)
    let isPanning = false;
    let panStart = null;
    let dragMoved = false;
    let downButton = 0;

    function getCanvasLocalFromClient(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (clientX - r.left) * dpr,
        y: (clientY - r.top) * dpr
      };
    }

    function addPointAtClient(clientX, clientY) {
      if (!_imgReady) return;
      const loc = getCanvasLocalFromClient(clientX, clientY);
      const pt = screenToImage(_state, loc.x, loc.y);

      if (_state.mode === "calibrate") {
        if (!_state.scalePts) _state.scalePts = [];
        if (_state.scalePts.length >= 2) _state.scalePts = [];
        _state.scalePts.push(pt);
        // Auto-recompute if we already have a known distance
        if (_state.scalePts.length === 2) {
          const upx = calcScaleFromKnown(_state);
          if (upx) _state.unitsPerPixel = upx;
        }
      } else {
        if (!_state.pathPts) _state.pathPts = [];
        _state.pathPts.push(pt);
      }

      saveState(_state);
      renderScaleStatus(panel);
      drawCanvas(_state, canvas, overlay);
    }

    function removeLastPoint() {
      if (_state.mode === "calibrate") {
        if (_state.scalePts && _state.scalePts.length) _state.scalePts.pop();
      } else {
        if (_state.pathPts && _state.pathPts.length) _state.pathPts.pop();
      }
      saveState(_state);
      renderScaleStatus(panel);
      drawCanvas(_state, canvas, overlay);
    }

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointerdown", (e) => {
      if (!_imgReady) return;

      downButton = typeof e.button === "number" ? e.button : 0;
      const wantsPan = _state.panEnabled || downButton === 2;
      if (!wantsPan) return;

      isPanning = true;
      dragMoved = false;

      const loc = getCanvasLocalFromClient(e.clientX, e.clientY);
      panStart = { x: loc.x, y: loc.y, panX: _state.view.panX, panY: _state.view.panY };

      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isPanning || !panStart) return;
      const loc = getCanvasLocalFromClient(e.clientX, e.clientY);
      const dx = loc.x - panStart.x;
      const dy = loc.y - panStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;

      _state.view.panX = panStart.panX + dx;
      _state.view.panY = panStart.panY + dy;
      _state._touchedView = true;

      drawCanvas(_state, canvas, overlay);
      e.preventDefault();
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!_imgReady) return;

      if (isPanning) {
        isPanning = false;
        panStart = null;
        canvas.style.cursor = _state.panEnabled ? "grab" : "crosshair";
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        saveState(_state);
        e.preventDefault();
        return;
      }

      // If pan toggle is on, we never place points with left click/tap.
      if (_state.panEnabled) return;

      // Left click/tap: place point (we use pointerup for reliability).
      if (downButton === 0 && !dragMoved) {
        addPointAtClient(e.clientX, e.clientY);
      }
    });

    canvas.addEventListener("pointercancel", (e) => {
      if (isPanning) {
        isPanning = false;
        panStart = null;
        canvas.style.cursor = _state.panEnabled ? "grab" : "crosshair";
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        saveState(_state);
      }
    });

    // Zoom
    canvas.addEventListener("wheel", (e) => {
      if (!_imgReady) return;
      e.preventDefault();

      const loc = getCanvasLocalFromClient(e.clientX, e.clientY);

      const oldZoom = _state.view.zoom || 1;
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.10 : 0.90;
      const newZoom = clamp(oldZoom * factor, 0.05, 15);

      // Zoom about cursor
      const before = screenToImage(_state, loc.x, loc.y);
      _state.view.zoom = newZoom;
      const afterScreen = imageToScreen(_state, before.x, before.y);
      _state.view.panX += (loc.x - afterScreen.x);
      _state.view.panY += (loc.y - afterScreen.y);

      _state._touchedView = true;
      drawCanvas(_state, canvas, overlay);
      saveState(_state);
    }, { passive: false });


    // Keyboard shortcuts while tool open
    function onKeyDown(e) {
      if (!panel.isConnected) {
        window.removeEventListener("keydown", onKeyDown);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        removeLastPoint();
      }
      if (e.key === "Escape") {
        // Clear current mode points
        if (_state.mode === "calibrate") _state.scalePts = [];
        else _state.pathPts = [];
        saveState(_state);
        renderScaleStatus(panel);
        drawCanvas(_state, canvas, overlay);
      }
    }
    window.addEventListener("keydown", onKeyDown);

    // Initial draw
    canvas.style.cursor = _state.panEnabled ? "grab" : "crosshair";
    drawCanvas(_state, canvas, overlay);
    renderScaleStatus(panel);
  }

  function renderScaleStatus(panel) {
    if (!panel) return;
    const statusEl = panel.querySelector("#mmScaleStatus");
    if (!statusEl) return;

    const px = calibrationPixels(_state);
    const upx = _state.unitsPerPixel;
    if (!px) {
      statusEl.innerHTML = `<span class="muted">Scale line:</span> none`;
      return;
    }
    const known = toNumber(_state.knownDistance, 1);
    const derived = known > 0 ? known / px : null;

    statusEl.innerHTML = `
      <span class="muted">Scale line:</span> <b>${round(px, 2)} px</b>
      ${derived ? `<span class="muted">→</span> <b>${round(derived, 6)} ${_state.unit}/px</b>` : ""}
      ${upx ? `<div class="mm-muted" style="margin-top:4px;">Active: <b>${round(upx, 6)} ${_state.unit}/px</b></div>` : ""}
    `;
  }

  function register() {
    const def = {
      id: TOOL_ID,
      name: TOOL_NAME,
      description: "Upload a map, calibrate scale, measure routes, and estimate travel time.",
      render
    };

    if (typeof window.registerTool === "function") {
      window.registerTool(def);
      if (typeof window.renderToolsNav === "function") window.renderToolsNav();
      return true;
    }

    // Fallback registration if loaded before app.js
    window.toolsConfig = window.toolsConfig || [];
    window.toolRenderers = window.toolRenderers || {};
    const base = { id: def.id, name: def.name, description: def.description || "" };
    const idx = window.toolsConfig.findIndex((t) => t && t.id === def.id);
    if (idx >= 0) window.toolsConfig[idx] = base;
    else window.toolsConfig.push(base);
    window.toolRenderers[def.id] = def.render;
    return true;
  }

  // Register now or shortly after if app.js isn't ready yet.
  if (!register()) {
    const started = Date.now();
    const timer = setInterval(() => {
      if (typeof window.registerTool === "function") {
        clearInterval(timer);
        register();
      }
      if (Date.now() - started > 6000) clearInterval(timer);
    }, 50);
  }
})();
