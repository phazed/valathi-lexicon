// tool-statblock-importer.js
(() => {
  const TOOL_ID = "statblockImporter";
  const TOOL_NAME = "Stat Block Importer";
  const STORAGE_KEY = "vrahuneStatblockImporterDraftsV3";
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

  const state = {
    imageDataUrl: "",
    ocrText: "",
    parsed: null,
    status: "idle", // idle | loading-lib | ocr | done | error
    progress: 0,
    error: "",
    lastInputMethod: "",
    activeTab: "ocr", // ocr | import
    importer: { mode: "json", text: "", items: [], selected: null, error: "" },
  };

  // -------------------------
  // Utils
  // -------------------------
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function toInt(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function uniq(arr) {
    return [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))];
  }
  function normalizeSpaces(s) {
    return String(s || "")
      .replace(/\r/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  function splitLines(text) {
    return normalizeSpaces(text)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  function listToLine(arr) {
    return (arr || []).join(", ");
  }
  function entriesToText(entries) {
    return (entries || []).map((e) => `${e.name}. ${e.text}`).join("\n");
  }
  function confBadge(level) {
    const c = level === "high" ? "#7bd88f" : level === "medium" ? "#ffd166" : "#ff9aa2";
    return `<span style="font-size:10px;border:1px solid ${c};color:${c};padding:1px 6px;border-radius:999px;">${esc(level || "low")}</span>`;
  }

  // -------------------------
  // Storage
  // -------------------------

  function toCanonicalMonster(obj) {
    if (!obj) return null;

    const m = obj;
    const name = String(m.name || m.monster_name || m.title || "").trim();
    if (!name) return null;

    const sizeType =
      String(m.sizeType || m.size_type || "").trim() ||
      String([m.size, m.type].filter(Boolean).join(" ")).trim();

    const alignment = String(m.alignment || "").trim();

    const acRaw = m.ac ?? m.armor_class ?? m.armorClass ?? "";
    const ac = toInt((typeof acRaw === "string" ? (acRaw.match(/\d+/)?.[0] || "") : acRaw), 0) || 10;

    const hpRaw = m.hp ?? m.hit_points ?? m.hitPoints ?? "";
    const hp = toInt((typeof hpRaw === "string" ? (hpRaw.match(/\d+/)?.[0] || "") : hpRaw), 0) || "";

    const hpFormula = String(m.hpFormula || m.hit_dice || m.hitDice || "").trim();
    const speed = String(m.speed || "").replace(/\s+/g, " ").trim();

    const str = toInt(m.str ?? m.strength, 10);
    const dex = toInt(m.dex ?? m.dexterity, 10);
    const con = toInt(m.con ?? m.constitution, 10);
    const intel = toInt(m.int ?? m.intelligence, 10);
    const wis = toInt(m.wis ?? m.wisdom, 10);
    const cha = toInt(m.cha ?? m.charisma, 10);

    const splitCsv = (v) =>
      String(v || "")
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const saves = Array.isArray(m.saves) ? m.saves : splitCsv(m.saving_throws || m.saves);
    const skills = Array.isArray(m.skills) ? m.skills : splitCsv(m.skills);

    const mapEntries = (arr) =>
      Array.isArray(arr)
        ? arr
            .map((x) => ({
              name: String(x?.name || "").trim(),
              text: String(x?.text || x?.desc || "").trim(),
            }))
            .filter((x) => x.name || x.text)
        : [];

    return {
      name,
      sizeType,
      alignment,
      ac,
      acText: String(m.acText || "").trim(),
      initiative: String(m.initiative || "").trim(),
      hp,
      hpFormula,
      speed,
      str,
      dex,
      con,
      int: intel,
      wis,
      cha,

      saves,
      skills,
      vulnerabilities: Array.isArray(m.vulnerabilities) ? m.vulnerabilities : splitCsv(m.damage_vulnerabilities || m.vulnerabilities),
      resistances: Array.isArray(m.resistances) ? m.resistances : splitCsv(m.damage_resistances || m.resistances),
      immunities: Array.isArray(m.immunities) ? m.immunities : splitCsv(m.damage_immunities || m.immunities),
      conditionImmunities: Array.isArray(m.conditionImmunities) ? m.conditionImmunities : splitCsv(m.condition_immunities || m.conditionImmunities),
      senses: String(m.senses || "").trim(),
      languages: String(m.languages || "").trim(),
      cr: String(m.cr || m.challenge_rating || "").trim(),
      xp: toInt(m.xp ?? m.experience_points ?? 0, 0),
      proficiencyBonus: toInt(m.pb ?? m.proficiencyBonus ?? m.proficiency_bonus ?? 2, 2),

      traits: mapEntries(m.traits || m.special_abilities),
      actions: mapEntries(m.actions),
      bonusActions: mapEntries(m.bonusActions || m.bonus_actions),
      reactions: mapEntries(m.reactions),
      legendaryActions: mapEntries(m.legendaryActions || m.legendary_actions),

      unmappedText: String(m.unmappedText || "").trim(),
      confidence: m.confidence || {},
    };
  }

  function getDrafts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function setDrafts(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr || []));
    } catch {}
  }
  function addDraft(monster) {
    const drafts = getDrafts();
    drafts.unshift(monster);
    setDrafts(drafts.slice(0, 50));
  }

  // -------------------------
  // Tesseract loader
  // -------------------------
  async function ensureTesseractLoaded() {
    if (window.Tesseract && window.Tesseract.recognize) return;
    state.status = "loading-lib";
    state.progress = 0;
    render({});
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // -------------------------
  // Image helpers
  // -------------------------
  function dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function preprocessImageVariant(img, opts = {}) {
    const scale = opts.scale ?? 1.0;
    const grayscale = !!opts.grayscale;
    const contrast = opts.contrast ?? 1.0;
    const threshold = opts.threshold ?? null;
    const denoise = !!opts.denoise;
    const sharpen = !!opts.sharpen;

    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    let imageData = ctx.getImageData(0, 0, w, h);
    let d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i],
        g = d[i + 1],
        b = d[i + 2];

      if (grayscale) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = lum;
      }

      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      if (threshold !== null && threshold !== undefined) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const t = lum >= threshold ? 255 : 0;
        r = g = b = t;
      }

      d[i] = clamp(r, 0, 255);
      d[i + 1] = clamp(g, 0, 255);
      d[i + 2] = clamp(b, 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);

    if (denoise) {
      imageData = ctx.getImageData(0, 0, w, h);
      d = imageData.data;
      const copy = new Uint8ClampedArray(d);
      const idx = (x, y) => (y * w + x) * 4;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let sum = 0,
            count = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const j = idx(x + ox, y + oy);
              const lum = 0.299 * copy[j] + 0.587 * copy[j + 1] + 0.114 * copy[j + 2];
              sum += lum;
              count++;
            }
          }
          const avg = sum / count;
          const j = idx(x, y);
          if (threshold !== null && threshold !== undefined) {
            const t = avg >= threshold ? 255 : 0;
            d[j] = d[j + 1] = d[j + 2] = t;
          } else {
            d[j] = d[j + 1] = d[j + 2] = avg;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    if (sharpen) {
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      const src = ctx.getImageData(0, 0, w, h);
      const out = ctx.getImageData(0, 0, w, h);
      const sd = src.data;
      const od = out.data;
      const idx = (x, y) => (y * w + x) * 4;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let r = 0,
            g = 0,
            b = 0;
          let k = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const j = idx(x + ox, y + oy);
              const kv = kernel[k++];
              r += sd[j] * kv;
              g += sd[j + 1] * kv;
              b += sd[j + 2] * kv;
            }
          }
          const j = idx(x, y);
          od[j] = clamp(r, 0, 255);
          od[j + 1] = clamp(g, 0, 255);
          od[j + 2] = clamp(b, 0, 255);
          od[j + 3] = sd[j + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
    }

    return c.toDataURL("image/png");
  }

  async function setImageFromBlob(blob, ctx = {}) {
    state.error = "";
    state.status = "idle";
    state.progress = 0;
    state.parsed = null;
    state.ocrText = "";
    state.lastInputMethod = ctx.method || "";
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    state.imageDataUrl = dataUrl;
    render(ctx);
  }

  // -------------------------
  // Parsing helpers
  // -------------------------
  function bestLine(lines, re) {
    for (const l of lines) if (re.test(l)) return l;
    return "";
  }

  function repairNumericOCR(s) {
    return String(s || "")
      .replace(/\bO(?=\d)/g, "0")
      .replace(/(?<=\d)O\b/g, "0")
      .replace(/\bI(?=\d)/g, "1")
      .replace(/(?<=\d)I\b/g, "1")
      .replace(/\bS(?=\d)/g, "5")
      .replace(/(?<=\d)S\b/g, "5")
      .replace(/\bB(?=\d)/g, "8")
      .replace(/(?<=\d)B\b/g, "8")
      .replace(/\bZ(?=\d)/g, "2")
      .replace(/(?<=\d)Z\b/g, "2");
  }

  function parseInitiative(lines, allText) {
    const coreJoin = repairNumericOCR((lines || []).join(" "));
    const full = repairNumericOCR(String(allText || ""));

    let m =
      /\bInitiative\b\s*[:\-]?\s*([+\-]?\d{1,2})(?:\s*\((\d{1,2})\))?/i.exec(coreJoin) ||
      /\bInitiative\b\s*[:\-]?\s*([+\-]?\d{1,2})(?:\s*\((\d{1,2})\))?/i.exec(full);

    if (m) {
      const mod = m[1];
      const rolled = m[2] ? ` (${m[2]})` : "";
      return { value: `${mod}${rolled}`.trim(), confidence: "high" };
    }

    return { value: "", confidence: "low" };
  }

  function parseAbilityBlock(lines, allText) {
    const text = repairNumericOCR(String(allText || ""));
    const joined = repairNumericOCR(lines.join(" "));

    const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    let conf = { str: "low", dex: "low", con: "low", int: "low", wis: "low", cha: "low" };

    const keyed = {};
    const re = /\b(STR|DEX|CON|INT|WIS|CHA)\b[^0-9]{0,8}(\d{1,2})\b/gi;
    let m;
    while ((m = re.exec(text))) keyed[m[1].toLowerCase()] = clamp(toInt(m[2], 10), 1, 30);
    while ((m = re.exec(joined))) keyed[m[1].toLowerCase()] = clamp(toInt(m[2], 10), 1, 30);

    for (const k of ["str", "dex", "con", "int", "wis", "cha"]) {
      if (Number.isFinite(keyed[k])) {
        abilities[k] = keyed[k];
        conf[k] = "high";
      }
    }

    return { abilities, conf };
  }

  function parseSavesSkills(lines) {
    const out = { saves: [], skills: [], confidence: { saves: "low", skills: "low" } };

    const saveLine = bestLine(lines, /^Saving Throws\b/i) || bestLine(lines, /^Saves\b/i);
    if (saveLine) {
      const v = saveLine.replace(/^Saving Throws?\b[:\s]*/i, "").replace(/^Saves\b[:\s]*/i, "").trim();
      if (v) out.saves = v.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      out.confidence.saves = out.saves.length ? "high" : "medium";
    }

    const skillLine = bestLine(lines, /^Skills?\b/i);
    if (skillLine) {
      const v = skillLine.replace(/^Skills?\b[:\s]*/i, "").trim();
      if (v) out.skills = v.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      out.confidence.skills = out.skills.length ? "high" : "medium";
    }

    return out;
  }

  function parseListField(lines, labelRe, confKey) {
    const line = bestLine(lines, labelRe);
    if (!line) return { list: [], confidence: "low" };
    const v = line.replace(labelRe, "").replace(/^[:\s]+/, "").trim();
    if (!v) return { list: [], confidence: "medium" };
    return { list: v.split(/,\s*/).map((s) => s.trim()).filter(Boolean), confidence: "high" };
  }

  function parseSensesLanguages(lines) {
    const senses = bestLine(lines, /^Senses\b/i);
    const languages = bestLine(lines, /^Languages?\b/i);

    const out = {
      senses: senses ? senses.replace(/^Senses\b[:\s]*/i, "").trim() : "",
      languages: languages ? languages.replace(/^Languages?\b[:\s]*/i, "").trim() : "",
      confidence: { senses: senses ? "high" : "low", languages: languages ? "high" : "low" },
    };
    return out;
  }

  function parseNameAndType(lines) {
    const first = (lines[0] || "").trim();
    const second = (lines[1] || "").trim();
    const name = first;
    let sizeType = "";
    let alignment = "";
    if (second) {
      const parts = second.split(/\.\s*/);
      sizeType = (parts[0] || "").trim();
      alignment = (parts[1] || "").trim();
    }
    return { name, sizeType, alignment, confidence: { name: name ? "high" : "low", sizeType: sizeType ? "medium" : "low", alignment: alignment ? "medium" : "low" } };
  }

  function sliceSections(lines) {
    const headers = ["TRAITS", "ACTIONS", "BONUS ACTIONS", "REACTIONS", "LEGENDARY ACTIONS", "MYTHIC ACTIONS"];
    const idx = {};
    for (const h of headers) {
      idx[h] = lines.findIndex((l) => l.trim().toUpperCase() === h);
    }
    const start = 0;
    const firstHeaderIdx = Math.min(...Object.values(idx).filter((n) => n >= 0), lines.length);
    const pre = lines.slice(start, firstHeaderIdx);

    const section = (name, startIdx, endIdx) => {
      if (startIdx < 0) return [];
      const end = endIdx >= 0 ? endIdx : lines.length;
      return lines.slice(startIdx + 1, end);
    };

    const order = headers
      .map((h) => ({ h, i: idx[h] }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i);

    const nextIdx = (h) => {
      const pos = order.findIndex((x) => x.h === h);
      if (pos < 0 || pos === order.length - 1) return -1;
      return order[pos + 1].i;
    };

    return {
      pre,
      traits: section("TRAITS", idx["TRAITS"], nextIdx("TRAITS")),
      actions: section("ACTIONS", idx["ACTIONS"], nextIdx("ACTIONS")),
      bonusActions: section("BONUS ACTIONS", idx["BONUS ACTIONS"], nextIdx("BONUS ACTIONS")),
      reactions: section("REACTIONS", idx["REACTIONS"], nextIdx("REACTIONS")),
      legendaryActions: section("LEGENDARY ACTIONS", idx["LEGENDARY ACTIONS"], nextIdx("LEGENDARY ACTIONS")),
      mythicActions: section("MYTHIC ACTIONS", idx["MYTHIC ACTIONS"], nextIdx("MYTHIC ACTIONS")),
    };
  }

  function parseEntries(blockLines) {
    const entries = [];
    let cur = null;

    for (const line of blockLines) {
      const m = /^([^\.]{2,80})\.\s*(.+)$/.exec(line);
      if (m) {
        if (cur) entries.push(cur);
        cur = { name: m[1].trim(), text: m[2].trim() };
      } else {
        if (!cur) {
          cur = { name: "", text: line.trim() };
        } else {
          cur.text = (cur.text + " " + line.trim()).trim();
        }
      }
    }
    if (cur) entries.push(cur);

    return entries.map((e) => ({ name: e.name || inferEntryName(e.text), text: e.text })).filter((e) => e.text);
  }

  function inferEntryName(text) {
    const t = String(text || "").trim();
    const m = /^([A-Z][A-Za-z'’\-\s]{2,40})\.\s/.exec(t);
    if (m) return m[1].trim();
    return "";
  }

  function scoreOcrText(text) {
    const t = String(text || "").toUpperCase();
    let score = 0;
    const must = ["AC", "HP", "SPEED", "STR", "DEX", "CON", "INT", "WIS", "CHA"];
    for (const k of must) if (t.includes(k)) score += 6;
    if (t.includes("ACTIONS")) score += 6;
    if (t.includes("TRAITS")) score += 4;
    if (t.includes("LEGENDARY ACTIONS")) score += 3;
    score += Math.min(15, (text.match(/\d{2,3}/g) || []).length * 0.4);
    score += Math.min(10, (text.match(/[()]/g) || []).length * 0.2);
    return score;
  }

  // -------------------------
  // Stat block preview (site-style)
  // -------------------------
  function modFromScore(score) {
    const s = toInt(score, 10);
    return Math.floor((s - 10) / 2);
  }
  function fmtMod(n) {
    const v = toInt(n, 0);
    return (v >= 0 ? "+" : "") + v;
  }
  function fmtModFromScore(score) {
    return fmtMod(modFromScore(score));
  }

  function statBlockPreviewFiveEtoolsLike(mon) {
    const m = mon || {};
    const name = esc(m.name || "Unknown");
    const sub = esc([m.sizeType, m.alignment].filter(Boolean).join(". ") || "");
    const ac = esc(String(m.ac ?? ""));
    const hp = esc(String(m.hp ?? ""));
    const hpF = esc(m.hpFormula || "");
    const init = esc(m.initiative || "");
    const speed = esc(m.speed || "");
    const senses = esc(m.senses || "");
    const langs = esc(m.languages || "");
    const cr = esc(m.cr || "");
    const pb = Number.isFinite(m.proficiencyBonus) ? `PB ${fmtMod(m.proficiencyBonus)}` : "";

    const saves = (m.saves && m.saves.length) ? esc(listToLine(m.saves)) : "";
    const skills = (m.skills && m.skills.length) ? esc(listToLine(m.skills)) : "";

    const vuln = (m.vulnerabilities && m.vulnerabilities.length) ? esc(listToLine(m.vulnerabilities)) : "";
    const resist = (m.resistances && m.resistances.length) ? esc(listToLine(m.resistances)) : "";
    const imm = (m.immunities && m.immunities.length) ? esc(listToLine(m.immunities)) : "";
    const cImm = (m.conditionImmunities && m.conditionImmunities.length) ? esc(listToLine(m.conditionImmunities)) : "";

    const abilityRow = (label, score, extra) => `
      <div class="o5-abil">
        <div class="o5-abilL">${label}</div>
        <div class="o5-abilR">${toInt(score, 10)} <span class="o5-mod">(${fmtModFromScore(score)})</span>${extra ? ` <span class="o5-save">${esc(extra)}</span>` : ""}</div>
      </div>
    `;

    const blocks = (title, arr) => {
      if (!arr || !arr.length) return "";
      return `
        <div class="o5-sec">
          <div class="o5-h">${esc(title)}</div>
          <div class="o5-list">
            ${arr
              .map(
                (e) =>
                  `<div class="o5-entry"><span class="o5-en">${esc(e.name || "")}${e.name ? "." : ""}</span> ${esc(e.text || "")}</div>`
              )
              .join("")}
          </div>
        </div>
      `;
    };

    const statline = (label, value) => value ? `<div class="o5-line"><span class="o5-k">${esc(label)}</span> <span class="o5-v">${value}</span></div>` : "";

    return `
      <div class="o5-wrap">
        <div class="o5-name">${name}</div>
        ${sub ? `<div class="o5-sub">${sub}</div>` : ""}

        <div class="o5-top">
          <div class="o5-line"><span class="o5-k">Armor Class</span> <span class="o5-v">${ac}</span></div>
          <div class="o5-line"><span class="o5-k">Hit Points</span> <span class="o5-v">${hp}${hpF ? ` <span class="o5-muted">(${hpF})</span>` : ""}</span></div>
          ${speed ? `<div class="o5-line"><span class="o5-k">Speed</span> <span class="o5-v">${speed}</span></div>` : ""}
          ${init ? `<div class="o5-line"><span class="o5-k">Initiative</span> <span class="o5-v">${init}</span></div>` : ""}
        </div>

        <div class="o5-abilities">
          ${abilityRow("STR", m.str, "")}
          ${abilityRow("DEX", m.dex, "")}
          ${abilityRow("CON", m.con, "")}
          ${abilityRow("INT", m.int, "")}
          ${abilityRow("WIS", m.wis, "")}
          ${abilityRow("CHA", m.cha, "")}
        </div>

        <div class="o5-meta">
          ${statline("Saving Throws", saves)}
          ${statline("Skills", skills)}
          ${statline("Damage Vulnerabilities", vuln)}
          ${statline("Damage Resistances", resist)}
          ${statline("Damage Immunities", imm)}
          ${statline("Condition Immunities", cImm)}
          ${statline("Senses", senses)}
          ${statline("Languages", langs)}
          ${(cr || pb) ? `<div class="o5-line"><span class="o5-k">Challenge</span> <span class="o5-v">${cr}${pb ? `; <span class="o5-muted">${pb}</span>` : ""}</span></div>` : ""}
        </div>

        ${blocks("Traits", m.traits)}
        ${blocks("Actions", m.actions)}
        ${blocks("Bonus Actions", m.bonusActions)}
        ${blocks("Reactions", m.reactions)}
        ${blocks("Legendary Actions", m.legendaryActions)}
      </div>
    `;
  }

  function template() {
    const p = state.parsed;

    const statusLine =
      state.status === "loading-lib"
        ? `Loading OCR library…`
        : state.status === "ocr"
        ? `Reading image… ${Math.round(state.progress * 100)}%`
        : state.status === "error"
        ? `Error: ${esc(state.error)}`
        : state.status === "done"
        ? `Parsed`
        : `Ready`;

    const drafts = getDrafts();

    return `
<style>
  /* Layout */
  .sbi-wrap{padding:16px 16px 24px 16px;color:#e9eefc;line-height:1.2;}
  .sbi-tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
  .sbi-tab{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e9eefc;border-radius:12px;padding:8px 12px;cursor:pointer;font-weight:800;}
  .sbi-tab.active{background:rgba(120,200,255,.14);border-color:rgba(120,200,255,.36);}
  .sbi-split{display:grid;grid-template-columns: 1.05fr .95fr; gap:12px; align-items:start;}
  @media (max-width: 980px){ .sbi-split{grid-template-columns:1fr;} }

  .sbi-card{border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); border-radius:16px; padding:12px;}
  .sbi-title{font-size:18px;font-weight:900;margin:0 0 10px 0}
  .sbi-muted{opacity:.8}
  .sbi-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .sbi-col{display:flex;flex-direction:column;gap:8px}
  .sbi-btnbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}

  .sbi-btn{border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#e9eefc;font-weight:900;padding:10px 12px;cursor:pointer}
  .sbi-btn.primary{background:rgba(120,200,255,.14);border-color:rgba(120,200,255,.35)}
  .sbi-btn.danger{background:rgba(255,120,120,.12);border-color:rgba(255,120,120,.35)}
  .sbi-btn:disabled{opacity:.45;cursor:not-allowed}

  .sbi-input{width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.2);color:#e9eefc;padding:10px 12px;outline:none}
  .sbi-input:focus{border-color:rgba(120,200,255,.45);box-shadow:0 0 0 2px rgba(120,200,255,.12)}
  .sbi-hint{font-size:12px;opacity:.75}

  /* Paste zone */
  .sbi-pasteZone{
    border:1px dashed rgba(255,255,255,.2);
    border-radius:16px;
    padding:14px;
    background:rgba(255,255,255,.04);
    cursor:text;
    outline:none;
    min-height:72px;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
  .sbi-pasteZone:focus{border-color:rgba(120,200,255,.45);box-shadow:0 0 0 2px rgba(120,200,255,.12)}
  .sbi-pasteZone strong{font-weight:900}
  .sbi-previewImg{max-width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:#0b1220}
  .sbi-status{margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
  .sbi-status--error{border-color:rgba(255,120,120,.35);background:rgba(255,120,120,.08)}
  .sbi-status--ok{border-color:rgba(120,255,170,.35);background:rgba(120,255,170,.08)}

  /* Form grid */
  .sbi-grid{display:grid;grid-template-columns: 1fr 1fr;gap:10px;margin-top:10px}
  @media (max-width: 980px){ .sbi-grid{grid-template-columns:1fr;} }
  .sbi-field label{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:900;margin-bottom:6px}
  .sbi-field small{opacity:.75;font-weight:700}
  .sbi-field textarea{min-height:90px;resize:vertical}

  /* Hover preview button */
  .sbi-hoverWrap{position:relative;display:inline-block;}
  .sbi-hoverPreview{
    position:fixed;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    z-index:9999;
    width:min(720px, 92vw);
    max-height:78vh;
    overflow:auto;
    border-radius:18px;
    border:1px solid rgba(255,255,255,.16);
    background:rgba(8,12,20,.96);
    box-shadow:0 24px 70px rgba(0,0,0,.55);
    padding:14px;
    display:none;
  }

  /* Preview */
  .o5-wrap{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:14px}
  .o5-name{font-weight:1000;font-size:22px;margin-bottom:2px}
  .o5-sub{font-style:italic;opacity:.85;margin-bottom:10px}
  .o5-line{margin:3px 0}
  .o5-k{font-weight:900}
  .o5-v{opacity:.98}
  .o5-muted{opacity:.7}
  .o5-top{padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.10);margin-bottom:10px}
  .o5-abilities{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 8px 0}
  @media (max-width: 520px){ .o5-abilities{grid-template-columns:repeat(2,1fr);} }
  .o5-abil{border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:8px 10px;background:rgba(255,255,255,.03)}
  .o5-abilL{font-weight:1000;opacity:.9}
  .o5-abilR{margin-top:2px;font-weight:900}
  .o5-mod{opacity:.75;font-weight:800}
  .o5-save{opacity:.8;font-weight:800}
  .o5-meta{padding-top:8px;border-top:1px solid rgba(255,255,255,.10);margin-top:8px}
  .o5-sec{margin-top:12px}
  .o5-h{font-weight:1000;letter-spacing:.4px;margin-bottom:6px}
  .o5-entry{margin:6px 0;line-height:1.25}
  .o5-en{font-weight:1000}
  .o5-list{margin-top:4px}

  /* Import grid */
  .sbi-importGrid{display:grid;grid-template-columns: 0.9fr 1.1fr;gap:12px;margin-top:12px;align-items:start}
  @media (max-width: 980px){ .sbi-importGrid{grid-template-columns:1fr;} }
  .sbi-o5-list{display:flex;flex-direction:column;gap:8px;max-height:520px;overflow:auto;padding-right:6px}
  .sbi-o5-item{width:100%;text-align:left;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e9eefc;padding:10px 12px;cursor:pointer}
  .sbi-o5-item.sel{border-color:rgba(120,200,255,.35);background:rgba(120,200,255,.10)}
</style>

<div class="sbi-wrap">
  <div class="sbi-tabs">
    <button type="button" id="sbi-tab-ocr" class="sbi-tab ${state.activeTab==="ocr"?"active":""}">OCR</button>
    <button type="button" id="sbi-tab-import" class="sbi-tab ${state.activeTab==="import"?"active":""}">Import</button>
  </div>

  <div class="sbi-status ${state.status==="error"?"sbi-status--error":state.status==="done"?"sbi-status--ok":""}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div><strong>Status:</strong> ${statusLine}</div>
      ${state.status==="ocr" ? `<div class="sbi-muted">${esc(state._activePass||"")}</div>` : ``}
    </div>
  </div>

<div class="sbi-card" style="display:${state.activeTab==="import"?"block":"none"};">
  <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">
    <div style="flex:1;min-width:220px;">
      <div class="sbi-muted" style="margin-bottom:6px;">Import type</div>
      <select id="sbi-import-mode" class="sbi-input">
        <option value="json" ${String(state.importer.mode||"json")==="json"?"selected":""}>JSON</option>
        <option value="markdown" ${String(state.importer.mode||"json")==="markdown"?"selected":""}>Markdown</option>
      </select>
    </div>
    <div class="sbi-btnbar" style="margin:0;">
      <button id="sbi-import-load" class="sbi-btn primary" type="button">Load</button>
      <button id="sbi-import-clear" class="sbi-btn danger" type="button">Clear</button>
    </div>
  </div>

  <div class="sbi-row" style="margin-top:10px;align-items:flex-start;">
    <div style="flex:1;min-width:260px;">
      <div class="sbi-muted" style="margin-bottom:6px;">Paste JSON or Markdown</div>
      <textarea id="sbi-import-text" class="sbi-input" style="height:160px;resize:vertical;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;" placeholder="Paste JSON (single object, array, or {results:[]}) or a Markdown stat block here.">${esc(state.importer.text || "")}</textarea>
      <div class="sbi-hint" style="margin-top:6px;">Everything stays in your browser. This tool does not upload files anywhere.</div>
    </div>
    <div style="width:260px;min-width:220px;">
      <div class="sbi-muted" style="margin-bottom:6px;">Or upload a file</div>
      <input id="sbi-import-file" type="file" accept="application/json,text/markdown,text/plain,.json,.md,.markdown,.txt" />
      <div class="sbi-hint" style="margin-top:8px;">Tip: You can import an exported JSON entry or paste a stat block you copied from anywhere.</div>
    </div>
  </div>

  ${state.importer.error ? `<div class="sbi-status sbi-status--error" style="margin-top:10px;">${esc(state.importer.error)}</div>` : ""}
</div>

<div class="sbi-importGrid" style="display:${state.activeTab==="import"?"grid":"none"};">
  <div class="sbi-card">
    <div style="font-weight:900;margin-bottom:8px;">Imported Entries</div>
    <div class="sbi-o5-list" id="sbi-import-list">
      ${(state.importer.items && state.importer.items.length)
        ? state.importer.items.slice(0, 200).map((it, idx) => {
            const sel = state.importer.selected === idx;
            const name = (it && it.name) ? it.name : `Entry ${idx+1}`;
            const sub = (it?.sizeType || it?.type || it?.size || "").toString();
            return `<button type="button" data-imp-idx="${idx}" class="sbi-o5-item ${sel?"sel":""}">
              <div style="font-weight:800;">${esc(name)}</div>
              <div class="sbi-muted" style="font-size:12px;">${esc(sub)}</div>
            </button>`;
          }).join("")
        : `<div class="sbi-muted">Paste JSON/Markdown or upload a file, then click <strong>Load</strong>.</div>`
      }
    </div>
  </div>

  <div class="sbi-card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div style="font-weight:900;">Stat Block Preview</div>
      <div class="sbi-btnbar" style="margin:0;">
        <button id="sbi-import-use" class="sbi-btn primary" type="button" ${Number.isFinite(state.importer.selected) ? "" : "disabled"}>Use in Importer</button>
        <button id="sbi-import-save" class="sbi-btn" type="button" ${Number.isFinite(state.importer.selected) ? "" : "disabled"}>Save Draft</button>
      </div>
    </div>

    ${Number.isFinite(state.importer.selected) && state.importer.items?.[state.importer.selected] ? `
      <div style="margin-top:10px;">
        <div style="border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px;background:rgba(0,0,0,.18);">
          ${statBlockPreviewFiveEtoolsLike(state.importer.items[state.importer.selected])}
        </div>
      </div>
    ` : `<div class="sbi-muted" style="margin-top:10px;">Select an entry to preview it.</div>`}
  </div>
</div>

<div class="sbi-split" style="display:${state.activeTab==="ocr"?"grid":"none"};">
    <div class="sbi-card">
      <div class="sbi-title">Input</div>

      <div class="sbi-row">
        <div style="flex:1;min-width:240px;">
          <div class="sbi-muted" style="margin-bottom:6px;">Paste screenshot (Win+Shift+S) or upload an image</div>
          <div id="sbi-paste-zone" class="sbi-pasteZone" tabindex="0">
            <div>
              <div><strong>Click here</strong> then press <strong>Ctrl+V</strong> to paste an image</div>
              <div class="sbi-hint" style="margin-top:4px;">(Works with Windows Snip &amp; Sketch)</div>
            </div>
          </div>
        </div>

        <div style="width:260px;min-width:220px;">
          <div class="sbi-muted" style="margin-bottom:6px;">Upload image</div>
          <input id="sbi-file" type="file" accept="image/*" />
          <div class="sbi-btnbar">
            <button id="sbi-run" class="sbi-btn primary" type="button" ${state.imageDataUrl ? "" : "disabled"}>Run OCR</button>
            <button id="sbi-clear" class="sbi-btn danger" type="button">Clear</button>
          </div>
          <div class="sbi-hint">OCR runs locally in your browser.</div>
        </div>
      </div>

      ${state.imageDataUrl ? `
        <div style="margin-top:12px;">
          <img class="sbi-previewImg" src="${state.imageDataUrl}" alt="preview"/>
        </div>
      ` : ``}

      <div class="sbi-field" style="margin-top:12px;">
        <label for="sbi-ocr-text">
          <span>OCR Text (editable)</span>
          <small>${state.lastInputMethod ? `Source: ${esc(state.lastInputMethod)}` : ""}</small>
        </label>
        <textarea id="sbi-ocr-text" class="sbi-input" style="min-height:160px;resize:vertical;">${esc(state.ocrText || "")}</textarea>
        <div class="sbi-btnbar">
          <button id="sbi-reparse" class="sbi-btn" type="button" ${state.ocrText ? "" : "disabled"}>Re-Parse Text</button>
          <button id="sbi-copy" class="sbi-btn" type="button" ${p ? "" : "disabled"}>Copy JSON</button>
        </div>
      </div>

      ${p ? `
        <div class="sbi-btnbar" style="margin-top:6px;">
          <button id="sbi-refresh-preview" class="sbi-btn" type="button">Update Preview from Fields</button>
          <button id="sbi-save" class="sbi-btn primary" type="button">Save Draft</button>

          <span class="sbi-hoverWrap">
            <button id="sbi-preview-hover-btn" class="sbi-btn" type="button">Hover Preview</button>
            <div id="sbi-hover-preview" class="sbi-hoverPreview">
              ${statBlockPreviewFiveEtoolsLike(p)}
            </div>
          </span>
        </div>
      ` : ``}
    </div>

    <div class="sbi-card">
      <div class="sbi-title">Parsed Fields</div>

      ${p ? `
        <div class="sbi-grid">
          ${fieldText("Name", "name", p.name, p.confidence?.name)}
          ${fieldText("Size/Type", "sizeType", p.sizeType, p.confidence?.sizeType)}
          ${fieldText("Alignment", "alignment", p.alignment, p.confidence?.alignment)}

          ${fieldNum("Armor Class", "ac", p.ac, p.confidence?.ac)}
          ${fieldText("AC Notes", "acText", p.acText, p.confidence?.acText)}
          ${fieldText("Initiative", "initiative", p.initiative, p.confidence?.initiative)}

          ${fieldNum("HP", "hp", p.hp, p.confidence?.hp)}
          ${fieldText("HP Formula", "hpFormula", p.hpFormula, p.confidence?.hpFormula)}

          ${fieldText("Speed", "speed", p.speed, p.confidence?.speed)}

          ${fieldNum("STR", "str", p.str, p.confidence?.str)}
          ${fieldNum("DEX", "dex", p.dex, p.confidence?.dex)}
          ${fieldNum("CON", "con", p.con, p.confidence?.con)}
          ${fieldNum("INT", "int", p.int, p.confidence?.int)}
          ${fieldNum("WIS", "wis", p.wis, p.confidence?.wis)}
          ${fieldNum("CHA", "cha", p.cha, p.confidence?.cha)}

          ${fieldText("Saving Throws", "saves", listToLine(p.saves), p.confidence?.saves)}
          ${fieldText("Skills", "skills", listToLine(p.skills), p.confidence?.skills)}

          ${fieldText("Vulnerabilities", "vulnerabilities", listToLine(p.vulnerabilities), p.confidence?.vulnerabilities)}
          ${fieldText("Resistances", "resistances", listToLine(p.resistances), p.confidence?.resistances)}
          ${fieldText("Immunities", "immunities", listToLine(p.immunities), p.confidence?.immunities)}
          ${fieldText("Condition Immunities", "conditionImmunities", listToLine(p.conditionImmunities), p.confidence?.conditionImmunities)}

          ${fieldText("Senses", "senses", p.senses, p.confidence?.senses)}
          ${fieldText("Languages", "languages", p.languages, p.confidence?.languages)}

          ${fieldText("CR", "cr", p.cr, p.confidence?.cr)}
          ${fieldNum("XP", "xp", p.xp, p.confidence?.xp)}
          ${fieldNum("PB", "proficiencyBonus", p.proficiencyBonus, p.confidence?.proficiencyBonus)}

          ${fieldArea("Traits", "traits", entriesToText(p.traits), p.confidence?.traits)}
          ${fieldArea("Actions", "actions", entriesToText(p.actions), p.confidence?.actions)}
          ${fieldArea("Bonus Actions", "bonusActions", entriesToText(p.bonusActions), p.confidence?.bonusActions)}
          ${fieldArea("Reactions", "reactions", entriesToText(p.reactions), p.confidence?.reactions)}
          ${fieldArea("Legendary Actions", "legendaryActions", entriesToText(p.legendaryActions), p.confidence?.legendaryActions)}

          ${fieldArea("Unmapped / Raw leftovers", "unmappedText", p.unmappedText, p.confidence?.unmappedText)}
        </div>
      ` : `
        <div class="sbi-muted">Run OCR, then review/edit fields here.</div>
      `}

      <div style="margin-top:14px;">
        <div class="sbi-title" style="font-size:16px;margin-bottom:8px;">Drafts</div>
        ${drafts.length ? drafts.slice(0, 8).map((d, i) => `
          <div style="border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.03);margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="font-weight:900;">${esc(d.name || "Unnamed")}</div>
              <button class="sbi-btn" type="button" data-draft-load="${i}">Load</button>
            </div>
            <div class="sbi-muted" style="margin-top:4px;font-size:12px;">${esc(d.sizeType || "")} ${d._savedAt ? `• saved ${esc(new Date(d._savedAt).toLocaleString())}` : ""}</div>
          </div>
        `).join("") : `<div class="sbi-muted">No drafts yet.</div>`}
      </div>
    </div>
  </div>
</div>
`;
  }

  function fieldText(label, id, value, conf) {
    return `
      <div class="sbi-field">
        <label for="sbi-${id}"><span>${esc(label)}</span><small>${confBadge(conf)}</small></label>
        <input id="sbi-${id}" class="sbi-input" value="${esc(value || "")}" />
      </div>
    `;
  }
  function fieldNum(label, id, value, conf) {
    return `
      <div class="sbi-field">
        <label for="sbi-${id}"><span>${esc(label)}</span><small>${confBadge(conf)}</small></label>
        <input id="sbi-${id}" class="sbi-input" inputmode="numeric" value="${esc(value ?? "")}" />
      </div>
    `;
  }
  function fieldArea(label, id, value, conf) {
    return `
      <div class="sbi-field" style="grid-column:1/-1;">
        <label for="sbi-${id}"><span>${esc(label)}</span><small>${confBadge(conf)}</small></label>
        <textarea id="sbi-${id}" class="sbi-input">${esc(value || "")}</textarea>
      </div>
    `;
  }

  function collectReviewed(panelEl) {
    const q = (id) => panelEl.querySelector(`#sbi-${id}`);
    if (!q("name")) return null;

    const parseEntriesText = (txt) => {
      const lines = splitLines(txt);
      return parseEntries(lines);
    };

    const parsed = {
      name: q("name").value.trim(),
      sizeType: q("sizeType").value.trim(),
      alignment: q("alignment").value.trim(),

      ac: toInt(q("ac").value, 10),
      acText: q("acText").value.trim(),
      initiative: q("initiative").value.trim(),

      hp: toInt(q("hp").value, 0),
      hpFormula: q("hpFormula").value.trim(),
      speed: q("speed").value.trim(),

      str: toInt(q("str").value, 10),
      dex: toInt(q("dex").value, 10),
      con: toInt(q("con").value, 10),
      int: toInt(q("int").value, 10),
      wis: toInt(q("wis").value, 10),
      cha: toInt(q("cha").value, 10),

      saves: uniq(q("saves").value.split(/,\s*/)),
      skills: uniq(q("skills").value.split(/,\s*/)),

      vulnerabilities: uniq(q("vulnerabilities").value.split(/,\s*/)),
      resistances: uniq(q("resistances").value.split(/,\s*/)),
      immunities: uniq(q("immunities").value.split(/,\s*/)),
      conditionImmunities: uniq(q("conditionImmunities").value.split(/,\s*/)),

      senses: q("senses").value.trim(),
      languages: q("languages").value.trim(),

      cr: q("cr").value.trim(),
      xp: toInt(q("xp").value, 0),
      proficiencyBonus: toInt(q("proficiencyBonus").value, 2),

      traits: parseEntriesText(q("traits").value),
      actions: parseEntriesText(q("actions").value),
      bonusActions: parseEntriesText(q("bonusActions").value),
      reactions: parseEntriesText(q("reactions").value),
      legendaryActions: parseEntriesText(q("legendaryActions").value),

      unmappedText: q("unmappedText").value,

      confidence: state.parsed?.confidence || {},
    };

    return parsed;
  }

  // -------------------------
  // Main parser
  // -------------------------
  function parseStatBlock(rawText) {
    const cleaned = normalizeSpaces(rawText);
    const lines = splitLines(cleaned);
    const sections = sliceSections(lines);

    const { name, sizeType, alignment, confidence: confHead } = parseNameAndType(sections.pre);
    const ac = parseAC(sections.pre, cleaned);
    const hp = parseHP(sections.pre, cleaned);
    const sp = parseSpeed(sections.pre, cleaned);
    const init = parseInitiative(sections.pre, cleaned);
    const ab = parseAbilityBlock(sections.pre, cleaned);

    const savesSkills = parseSavesSkills(sections.pre);
    const vuln = parseListField(sections.pre, /^Damage Vulnerabilities?\b/i);
    const resist = parseListField(sections.pre, /^Damage Resistances?\b/i);
    const immune = parseListField(sections.pre, /^Damage Immunities?\b/i);
    const condImm = parseListField(sections.pre, /^Condition Immunities?\b/i);
    const sl = parseSensesLanguages(sections.pre);
    const crpb = parseCRPB(sections.pre, cleaned);

    const traits = parseEntries(sections.traits);
    const actions = parseEntries(sections.actions);
    const bonusActions = parseEntries(sections.bonusActions);
    const reactions = parseEntries(sections.reactions);
    const legendaryActions = parseEntries(sections.legendaryActions);

    const usedLines = new Set([
      ...sections.pre,
      ...sections.traits,
      ...sections.actions,
      ...sections.bonusActions,
      ...sections.reactions,
      ...sections.legendaryActions,
    ]);

    const unmappedText = lines.filter((l) => !usedLines.has(l)).join("\n").trim();

    const confidence = {
      ...confHead,
      ac: ac.confidence,
      hp: hp.confidence,
      hpFormula: hp.formula ? "high" : "low",
      speed: sp.confidence,
      initiative: init.confidence,
      str: ab.conf.str,
      dex: ab.conf.dex,
      con: ab.conf.con,
      int: ab.conf.int,
      wis: ab.conf.wis,
      cha: ab.conf.cha,
      saves: savesSkills.confidence.saves,
      skills: savesSkills.confidence.skills,
      vulnerabilities: vuln.confidence,
      resistances: resist.confidence,
      immunities: immune.confidence,
      conditionImmunities: condImm.confidence,
      senses: sl.confidence.senses,
      languages: sl.confidence.languages,
      cr: crpb.crConf,
      xp: crpb.xp ? "medium" : "low",
      proficiencyBonus: crpb.pbConf,
      traits: traits.length ? "medium" : "low",
      actions: actions.length ? "medium" : "low",
      bonusActions: bonusActions.length ? "medium" : "low",
      reactions: reactions.length ? "medium" : "low",
      legendaryActions: legendaryActions.length ? "medium" : "low",
      unmappedText: unmappedText ? "low" : "high",
    };

    return {
      name,
      sizeType,
      alignment,
      ac: ac.value,
      acText: ac.notes,
      initiative: init.value,
      hp: hp.value,
      hpFormula: hp.formula,
      speed: sp.value,

      ...ab.abilities,

      saves: savesSkills.saves,
      skills: savesSkills.skills,

      vulnerabilities: vuln.list,
      resistances: resist.list,
      immunities: immune.list,
      conditionImmunities: condImm.list,

      senses: sl.senses,
      languages: sl.languages,

      cr: crpb.cr,
      xp: crpb.xp,
      proficiencyBonus: crpb.pb,

      traits,
      actions,
      bonusActions,
      reactions,
      legendaryActions,

      unmappedText,
      confidence,
    };
  }

  // -------------------------
  // Tool integration
  // -------------------------
  function bind(labelEl, panelEl) {
    if (panelEl._sbiCleanup && Array.isArray(panelEl._sbiCleanup)) {
      for (const fn of panelEl._sbiCleanup) {
        try { fn(); } catch {}
      }
    }
    panelEl._sbiCleanup = [];

    const q = (id) => panelEl.querySelector(`#${id}`);

    const pasteZone = q("sbi-paste-zone");
    const fileEl = q("sbi-file");

    const onZonePaste = async (e) => {
      try {
        const items = e.clipboardData?.items || [];
        for (const it of items) {
          if (it.type && it.type.startsWith("image/")) {
            e.preventDefault();
            const blob = it.getAsFile();
            if (blob) {
              await setImageFromBlob(blob, { labelEl, panelEl, method: "clipboard paste" });
              return;
            }
          }
        }
      } catch (err) {
        state.status = "error";
        state.error = `Paste failed: ${err?.message || err}`;
        render({ labelEl, panelEl });
      }
    };

    const onGlobalPaste = async (e) => {
      if (!panelEl || !panelEl.isConnected) return;
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          e.preventDefault();
          const blob = it.getAsFile();
          if (blob) {
            await setImageFromBlob(blob, { labelEl, panelEl, method: "clipboard paste" });
            return;
          }
        }
      }
    };

    pasteZone?.addEventListener("click", () => pasteZone.focus());
    pasteZone?.addEventListener("paste", onZonePaste);
    window.addEventListener("paste", onGlobalPaste);

    panelEl._sbiCleanup.push(() => {
      pasteZone?.removeEventListener("paste", onZonePaste);
      window.removeEventListener("paste", onGlobalPaste);
    });

    fileEl?.addEventListener("change", async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        await setImageFromBlob(file, { labelEl, panelEl, method: "file upload" });
      } catch (err) {
        state.status = "error";
        state.error = `File load failed: ${err?.message || err}`;
        render({ labelEl, panelEl });
      }
    });

    q("sbi-clear")?.addEventListener("click", () => {
      state.imageDataUrl = "";
      state.ocrText = "";
      state.parsed = null;
      state.status = "idle";
      state.progress = 0;
      state.error = "";
      state.lastInputMethod = "";
      render({ labelEl, panelEl });
    });

    q("sbi-run")?.addEventListener("click", async () => {
      try {
        state.status = "ocr";
        state.progress = 0;
        state._activePass = "";
        render({ labelEl, panelEl });

        const ocr = await runMultiPassOCR(state.imageDataUrl, (p, passName) => {
          state.progress = p;
          state._activePass = passName;
        });

        state.ocrText = ocr.best.text;
        state._ocrCandidates = ocr.all;
        state.parsed = parseStatBlock(ocr.best.text);
        state.status = "done";
      } catch (err) {
        state.status = "error";
        state.error = `OCR failed: ${err?.message || err}`;
      }
      render({ labelEl, panelEl });
    });

    q("sbi-reparse")?.addEventListener("click", () => {
      const raw = q("sbi-ocr-text")?.value || "";
      state.ocrText = raw;
      state.parsed = parseStatBlock(raw);
      state.status = "done";
      render({ labelEl, panelEl });
    });

    q("sbi-refresh-preview")?.addEventListener("click", () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      state.parsed = reviewed;
      render({ labelEl, panelEl });
    });

    q("sbi-save")?.addEventListener("click", () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      state.parsed = reviewed;
      addDraft({ ...reviewed, _savedAt: new Date().toISOString() });
      alert("Saved to Stat Block Importer drafts.");
      render({ labelEl, panelEl });
    });

    const previewBtn = q("sbi-preview-hover-btn");
    const previewEl = q("sbi-hover-preview");
    const showPreview = () => { if (previewEl) previewEl.style.display = "block"; };
    const hidePreview = () => { if (previewEl) previewEl.style.display = "none"; };
    previewBtn?.addEventListener("mouseenter", showPreview);
    previewBtn?.addEventListener("mouseleave", hidePreview);
    previewEl?.addEventListener("mouseenter", showPreview);
    previewEl?.addEventListener("mouseleave", hidePreview);

    q("sbi-copy")?.addEventListener("click", async () => {
      const reviewed = collectReviewed(panelEl);
      if (!reviewed) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(reviewed, null, 2));
        alert("Copied JSON.");
      } catch {
        alert("Clipboard copy failed.");
      }
    });

    // Tabs
    q("sbi-tab-ocr")?.addEventListener("click", () => {
      state.activeTab = "ocr";
      render({ labelEl, panelEl });
    });
    q("sbi-tab-import")?.addEventListener("click", () => {
      state.activeTab = "import";
      render({ labelEl, panelEl });
    });

    // Import: file -> textarea
    q("sbi-import-file")?.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const txt = await f.text();
        state.importer.text = txt;
        const ta = q("sbi-import-text");
        if (ta) ta.value = txt;
      } catch (err) {
        state.importer.error = err?.message || String(err);
      }
      render({ labelEl, panelEl });
    });

    q("sbi-import-mode")?.addEventListener("change", (e) => {
      state.importer.mode = e.target.value || "json";
      render({ labelEl, panelEl });
    });

    q("sbi-import-clear")?.addEventListener("click", () => {
      state.importer.text = "";
      state.importer.items = [];
      state.importer.selected = null;
      state.importer.error = "";
      const ta = q("sbi-import-text");
      if (ta) ta.value = "";
      const fi = q("sbi-import-file");
      if (fi) fi.value = "";
      render({ labelEl, panelEl });
    });

    q("sbi-import-load")?.addEventListener("click", () => {
      const ta = q("sbi-import-text");
      const raw = (ta ? ta.value : state.importer.text) || "";
      state.importer.text = raw;
      state.importer.error = "";
      state.importer.items = [];
      state.importer.selected = null;

      const mode = state.importer.mode || "json";

      try {
        if (mode === "markdown") {
          const parsed = parseStatBlock(raw);
          if (!parsed || !parsed.name) throw new Error("Couldn't parse a stat block from that Markdown/text.");
          state.importer.items = [parsed];
          state.importer.selected = 0;
        } else {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed)
            ? parsed
            : (parsed?.results && Array.isArray(parsed.results) ? parsed.results : [parsed]);
          const normalized = arr.map((x) => toCanonicalMonster(x)).filter(Boolean);
          state.importer.items = normalized;
          state.importer.selected = state.importer.items.length ? 0 : null;
          if (!state.importer.items.length) state.importer.error = "No entries found in that JSON.";
        }
      } catch (err) {
        state.importer.error = (mode === "json" ? "Invalid JSON: " : "Import failed: ") + (err?.message || String(err));
      }

      render({ labelEl, panelEl });
    });

    // Imported list selection
    panelEl.querySelectorAll("[data-imp-idx]")?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-imp-idx"));
        if (!Number.isFinite(idx)) return;
        state.importer.selected = idx;
        render({ labelEl, panelEl });
      });
    });

    q("sbi-import-use")?.addEventListener("click", () => {
      if (!Number.isFinite(state.importer.selected)) return;
      const picked = state.importer.items?.[state.importer.selected];
      if (!picked) return;
      state.parsed = picked;
      state.ocrText = "";
      state.status = "done";
      state.activeTab = "ocr";
      state.lastInputMethod = "Import";
      render({ labelEl, panelEl });
    });

    q("sbi-import-save")?.addEventListener("click", () => {
      if (!Number.isFinite(state.importer.selected)) return;
      const picked = state.importer.items?.[state.importer.selected];
      if (!picked) return;
      addDraft({ ...picked, _savedAt: new Date().toISOString() });
      alert("Saved imported entry to Stat Block Importer drafts.");
      render({ labelEl, panelEl });
    });

    // Draft load buttons
    panelEl.querySelectorAll("[data-draft-load]")?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-draft-load"));
        const drafts = getDrafts();
        const d = drafts[idx];
        if (!d) return;
        state.parsed = d;
        state.status = "done";
        state.activeTab = "ocr";
        render({ labelEl, panelEl });
      });
    });
  }

  function render({ labelEl, panelEl } = {}) {
    if (!panelEl) return;
    if (labelEl) labelEl.textContent = TOOL_NAME;

    // Preserve focus/cursor so typing doesn't require re-clicks
    const ae = document.activeElement;
    const aeId = ae && ae.id ? ae.id : null;
    let selStart = null, selEnd = null;
    if (ae && aeId && typeof ae.selectionStart === "number") {
      selStart = ae.selectionStart;
      selEnd = ae.selectionEnd;
    }

    panelEl.innerHTML = template();
    bind(labelEl, panelEl);

    if (aeId) {
      const next = panelEl.querySelector(`#${CSS.escape(aeId)}`);
      if (next && typeof next.focus === "function") {
        next.focus();
        if (selStart !== null && typeof next.setSelectionRange === "function") {
          try { next.setSelectionRange(selStart, selEnd ?? selStart); } catch {}
        }
      }
    }
  }

  // -------------------------
  // OCR passes (multi-variant + 2-column split)
  // -------------------------
  function imageToCanvas(img) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  }
  function cropCanvasRegion(srcCanvas, x, y, w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext("2d");
    ctx.drawImage(srcCanvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, c.width, c.height);
    return c;
  }
  function estimateTwoColumnSplitX(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width: w, height: h } = canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    const startX = Math.floor(w * 0.33), endX = Math.floor(w * 0.67);
    let bestX = Math.floor(w/2), bestScore = Infinity;
    for (let x=startX; x<=endX; x++) {
      let ink = 0;
      for (let y=0; y<h; y+=2) {
        const i=(y*w+x)*4;
        const lum = 0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
        ink += (255-lum);
      }
      if (ink < bestScore) { bestScore = ink; bestX = x; }
    }
    return bestX;
  }
  async function splitIntoColumnsDataUrls(dataUrl, opts={}) {
    const { forceTwoColumn=true, gutterPx=20, minWidthForTwoCol=700 } = opts;
    const img = await dataUrlToImage(dataUrl);
    const base = imageToCanvas(img);
    const w=base.width, h=base.height;
    if (!forceTwoColumn && w < minWidthForTwoCol) return [{name:"single",dataUrl}];
    const splitX = estimateTwoColumnSplitX(base);
    const leftW = Math.max(1, splitX-gutterPx);
    const rightX = Math.min(w-1, splitX+gutterPx);
    const rightW = Math.max(1, w-rightX);
    const left = cropCanvasRegion(base, 0, 0, leftW, h).toDataURL("image/png");
    const right = cropCanvasRegion(base, rightX, 0, rightW, h).toDataURL("image/png");
    return [{name:"left-col",dataUrl:left},{name:"right-col",dataUrl:right}];
  }
  async function runOcrOnDataUrl(dataUrl, onProgress, base=0, span=1, passName="") {
    const rec = await window.Tesseract.recognize(dataUrl, "eng", {
      logger: (m)=> {
        if (m?.status === "recognizing text" && Number.isFinite(m.progress)) onProgress?.(base + m.progress*span, passName);
      }
    });
    return normalizeSpaces(rec?.data?.text || "");
  }
  async function runMultiPassOCR(dataUrl, onProgress) {
    await ensureTesseractLoaded();
    const img = await dataUrlToImage(dataUrl);
    const variants = [
      { name: "raw", dataUrl },
      { name: "upscale-gray-contrast", dataUrl: preprocessImageVariant(img, { scale: 1.8, grayscale: true, contrast: 1.35, threshold: null, denoise: true }) },
      { name: "upscale-threshold", dataUrl: preprocessImageVariant(img, { scale: 2.0, grayscale: true, contrast: 1.45, threshold: 170, denoise: true, sharpen: true }) },
    ];
    const results = [];
    for (let i=0;i<variants.length;i++) {
      const v=variants[i];
      const single = await runOcrOnDataUrl(v.dataUrl, onProgress, i/variants.length, 0.45/variants.length, `${v.name}-single`);
      const cols = await splitIntoColumnsDataUrls(v.dataUrl, { forceTwoColumn:true, gutterPx:20, minWidthForTwoCol:700 });
      let combined = single;
      if (cols.length===2){
        const left = await runOcrOnDataUrl(cols[0].dataUrl, onProgress, (i/variants.length)+(0.45/variants.length), 0.275/variants.length, `${v.name}-left`);
        const right = await runOcrOnDataUrl(cols[1].dataUrl, onProgress, (i/variants.length)+(0.725/variants.length), 0.275/variants.length, `${v.name}-right`);
        combined = normalizeSpaces(`${left}\n${right}`);
      }
      results.push({ name:`${v.name}-single`, text:single, score:scoreOcrText(single) });
      results.push({ name:`${v.name}-columns`, text:combined, score:scoreOcrText(combined)+8 });
    }
    results.sort((a,b)=>b.score-a.score);
    return { best: results[0], all: results };
  }

  // -------------------------
  // Guards + robustness helpers (kept from prior iterations)
  // -------------------------
  const FIELD_BLOCK_PATTERNS = {
    alignment:[/\bmelee weapon attack\b/i,/\branged weapon attack\b/i,/\battack roll\b/i,/\bhit:\b/i,/\bactions?\b/i,/\breactions?\b/i,/\blegendary actions?\b/i,/\bbonus actions?\b/i],
    sizeType:[/\bmelee weapon attack\b/i,/\branged weapon attack\b/i,/\battack roll\b/i,/\bhit:\b/i,/\bactions?\b/i],
    languages:[/\bmelee weapon attack\b/i,/\branged weapon attack\b/i,/\bhit:\b/i,/\bactions?\b/i],
    senses:[/\bmelee weapon attack\b/i,/\branged weapon attack\b/i,/\bhit:\b/i,/\bactions?\b/i],
  };
  function containsBlockedPattern(v, field){ const s=String(v||"").trim(); return (FIELD_BLOCK_PATTERNS[field]||[]).some(re=>re.test(s));}
  function cleanScalar(v){ return String(v||"").replace(/\s{2,}/g," ").replace(/[|]/g,"").trim();}
  const ALIGNMENT_ALLOW_RE=/^(unaligned|any alignment|any non-good alignment|any non-lawful alignment|any non-evil alignment|lawful good|neutral good|chaotic good|lawful neutral|neutral|chaotic neutral|lawful evil|neutral evil|chaotic evil)(\s*\(.+\))?$/i;
  function sanitizeAlignment(value){
    let v=cleanScalar(value);
    if (!v || containsBlockedPattern(v,"alignment")) return "";
    v=v.split(/\b(?:Actions?|Reactions?|Legendary Actions?|Bonus Actions?)\b/i)[0].trim();
    if (ALIGNMENT_ALLOW_RE.test(v)) return v;
    const known=["lawful good","neutral good","chaotic good","lawful neutral","neutral","chaotic neutral","lawful evil","neutral evil","chaotic evil","unaligned","any alignment","any non-good alignment","any non-lawful alignment","any non-evil alignment"];
    const low=v.toLowerCase();
    for (const k of known){ const idx=low.indexOf(k); if (idx>=0) return k.replace(/\b\w/g,c=>c.toUpperCase()); }
    return "";
  }
  function sanitizeSizeType(value){
    let v=cleanScalar(value);
    if (!v || containsBlockedPattern(v,"sizeType")) return "";
    v=v.replace(/[.]+$/,"").trim();
    if (/\b(?:melee weapon attack|ranged weapon attack|hit:|actions?)\b/i.test(v)) return "";
    return v;
  }
  function sanitizeListField(items, fieldName){
    const arr=Array.isArray(items)?items:String(items||"").split(/[,;]+/);
    return [...new Set(arr.map(x=>cleanScalar(x)).filter(x=>x && !containsBlockedPattern(x, fieldName) && !/^(actions?|reactions?|legendary actions?|bonus actions?)$/i.test(x)))];
  }
  function normalizeOcr(text){
    return String(text||"")
      .replace(/\bA\s*C\b/gi,"AC")
      .replace(/\bH\s*P\b/gi,"HP")
      .replace(/\bArmor\s*C1ass\b/gi,"Armor Class")
      .replace(/\bHit\s*Po1nts\b/gi,"Hit Points")
      .replace(/\bHit\s*P0ints\b/gi,"Hit Points")
      .replace(/\b(\d)\s*ft\b/gi,"$1 ft.")
      .replace(/[|]/g," ")
      .replace(/\s{2,}/g," ")
      .trim();
  }
  function sliceByHeaders(lines){
    const up = (s)=>String(s||"").trim().toUpperCase();
    const findIdx=(h)=>lines.findIndex(l=>up(l)===h);
    const idxTraits=findIdx("TRAITS");
    const idxActions=findIdx("ACTIONS");
    const idxBonus=findIdx("BONUS ACTIONS");
    const idxReac=findIdx("REACTIONS");
    const idxLeg=findIdx("LEGENDARY ACTIONS");
    const first=Math.min(...[idxTraits,idxActions,idxBonus,idxReac,idxLeg].filter(i=>i>=0), lines.length);
    const pre=lines.slice(0, first);
    return { pre };
  }
  function splitPreIntoCoreMetaTraits(pre) {
    const core=[], meta=[], traitCandidates=[];
    const coreLabels=[/^Armor Class\b/i,/^AC\b/i,/^Hit Points?\b/i,/^HP\b/i,/^Speed\b/i,/^Initiative\b/i,/^STR\b/i,/^DEX\b/i,/^CON\b/i,/^INT\b/i,/^WIS\b/i,/^CHA\b/i,/^Challenge\b/i,/^CR\b/i,/^Proficiency Bonus\b/i,/^PB\b/i];
    const metaLabels=[/^Saving Throws?\b/i,/^Saves\b/i,/^Skills?\b/i,/^Damage Vulnerabilities?\b/i,/^Vulnerabilities\b/i,/^Damage Resistances?\b/i,/^Resistances\b/i,/^Damage Immunities?\b/i,/^Immunities\b/i,/^Condition Immunities?\b/i,/^Senses\b/i,/^Languages\b/i,/^Habitat\b/i,/^Environment\b/i];
    const ignore=[/^MOD\b/i,/^SAVE\b/i,/^MOD\s+SAVE\b/i,/^SAVE\s+MOD\b/i];
    const any=(line, arr)=>arr.some(re=>re.test(line));
    for (let i=2;i<pre.length;i++){
      const line=(pre[i]||"").trim(); if(!line) continue;
      if (any(line, ignore)) continue;
      if (any(line, coreLabels) || /\b(?:AC|HP|Speed|Initiative|CR|PB)\b/i.test(line)) { core.push(line); continue; }
      if (any(line, metaLabels) || /understands|can't speak|telepathy|darkvision|blindsight|tremorsense|truesight/i.test(line)) { meta.push(line); continue; }
      traitCandidates.push(line);
    }
    return { core, meta, traitCandidates };
  }

  // -------------------------
  // AC stability patch (anchored AC detection)
  // -------------------------
  function parseACRobust(coreLines = [], allText = "") {
    const joinedCore = (coreLines || []).join("\n");
    const raw = `${joinedCore}\n${allText || ""}`;

    const norm = String(raw || "")
      .replace(/[|]/g, " ")
      .replace(/\bA\s*C\b/gi, "AC")
      .replace(/\bArmor\s*Class\b/gi, "Armor Class")
      .replace(/\bArmor\s*C1ass\b/gi, "Armor Class")
      .replace(/\bArmorClass\b/gi, "Armor Class")
      .replace(/\b([Il])(\d)\b/g, "1$2")
      .replace(/\b(\d)[Oo]\b/g, "$10")
      .replace(/\s+/g, " ")
      .trim();

    const lines = norm
      .split(/(?<=[.!?])\s+|\n/)
      .map(s => s.trim())
      .filter(Boolean);

    const isContaminated = (s) =>
      /\b(melee weapon attack|ranged weapon attack|attack roll|hit:|actions?|reactions?|legendary actions?)\b/i.test(s || "");

    const candidates = [];
    const push = (value, score, line, notes = "") => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1 || n > 30) return;
      candidates.push({ value: n, score, line, notes });
    };

    for (const line of lines) {
      if (!line || isContaminated(line)) continue;

      let m = /(?:^|\s)(?:AC|Armor\s*Class)\s*[:\-]?\s*(\d{1,2})(?=\b|\s|$)/i.exec(line);
      if (m) {
        const hasCoreNeighbors = /\b(initiative|hp|hit points|speed|cr|pb)\b/i.test(line);
        push(m[1], hasCoreNeighbors ? 100 : 95, line);
        continue;
      }

      m = /(?:^|\s)AC(\d{1,2})(?=\b|\s|$)/i.exec(line);
      if (m) {
        const hasCoreNeighbors = /\b(initiative|hp|hit points|speed|cr|pb)\b/i.test(line);
        push(m[1], hasCoreNeighbors ? 98 : 90, line);
        continue;
      }

      m = /(?:^|\s)Armor\s*Class(\d{1,2})(?=\b|\s|$)/i.exec(line);
      if (m) {
        const hasCoreNeighbors = /\b(initiative|hp|hit points|speed|cr|pb)\b/i.test(line);
        push(m[1], hasCoreNeighbors ? 98 : 88, line);
        continue;
      }
    }

    if (!candidates.length) {
      const top = norm.slice(0, 280);
      let m = /\b(?:AC|Armor\s*Class)\s*[:\-]?\s*(\d{1,2})\b/i.exec(top);
      if (!m) m = /\bAC(\d{1,2})\b/i.exec(top);
      if (!m) m = /\bArmor\s*Class(\d{1,2})\b/i.exec(top);
      if (m) push(m[1], 75, top);
    }

    if (candidates.length) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      return {
        value: best.value,
        notes: best.notes || "",
        confidence: best.score >= 95 ? "high" : best.score >= 80 ? "medium" : "low",
        sourceLine: best.line || ""
      };
    }

    return { value: 10, notes: "", confidence: "low", sourceLine: "" };
  }

  // keep parseAC name used by parser
  parseAC = function(coreLines, allText){ return parseACRobust(coreLines, allText); };

  // Overwrite parseStatBlock to re-apply AC anchoring at the end
  const __prevParseStatBlock = parseStatBlock;
  parseStatBlock = function(rawInput) {
    let result = __prevParseStatBlock(rawInput);
    try {
      const cleaned = normalizeOcr(rawInput || "");
      const lines = splitLines(cleaned);
      const sliced = sliceByHeaders(lines);
      const preSplit = splitPreIntoCoreMetaTraits(sliced.pre || []);
      const ac = parseACRobust(preSplit.core || [], cleaned);

      result = result || {};
      result.confidence = result.confidence || {};

      const currentAc = Number(result.ac);
      const currentConf = String(result.confidence.ac || "").toLowerCase();
      const nextConf = String(ac.confidence || "").toLowerCase();

      const shouldOverwrite = (
        !Number.isFinite(currentAc) ||
        currentAc < 1 || currentAc > 30 ||
        currentConf !== "high" ||
        nextConf === "high"
      );

      if (shouldOverwrite) {
        result.ac = ac.value;
        result.acText = ac.notes || "";
        result.confidence.ac = ac.confidence;
      }
    } catch (e) {}
    return result;
  };

  // Register tool
  window.registerTool({
    id: TOOL_ID,
    name: TOOL_NAME,
    description: "Paste/upload screenshot, OCR locally, parse into structured fields. Includes JSON/Markdown import tab.",
    render,
  });

})();
