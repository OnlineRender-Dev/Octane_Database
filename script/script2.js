/* ===== CONFIG ===== */
const CSV_URL = "https://docs.google.com/spreadsheets/d/11UQ30w2GEIYPBhnZP1aiSz-pYtdKy_dUscjYWorW05o/export?format=csv&gid=4385312";

/* Progressive rendering: show all rows in batches so the UI stays responsive */
const CHUNK_SIZE = 500; // rows per batch

const rIC = window.requestIdleCallback || function (cb) {
  return setTimeout(() => cb({ timeRemaining: () => 0, didTimeout: true }), 16);
};

/* ===== State ===== */
let allRows = [];
let activeRows = [];
let fuse = null;

let currentSortKey = null;       // e.g., "subscribers"
let currentSortDir = "asc";      // "asc" | "desc"
let isSearching = false;

/* ===== UI Prefs (theme/layout/thumbs) ===== */
function initTheme() {
  let saved = localStorage.getItem("theme");
  if (!saved) {
    saved = "dark"; // default
    localStorage.setItem("theme", "dark");
  }
  document.body.classList.toggle("dark", saved === "dark");
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = (saved === "dark");
}
function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    const dark = toggle.checked;
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  });
}

/* Infer from DOM on first load; keep DOM + storage + toggle in sync */
function initLayoutToggle() {
  let saved = localStorage.getItem("layoutMode");
  if (!saved) {
    saved = document.body.classList.contains("narrow-layout") ? "narrow" : "wide";
    localStorage.setItem("layoutMode", saved);
  }
  document.body.classList.toggle("narrow-layout", saved === "narrow");
  const toggle = document.getElementById("layoutToggle");
  if (toggle) toggle.checked = (saved === "wide");
}
function setupLayoutToggle() {
  const toggle = document.getElementById("layoutToggle");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    const wide = toggle.checked;
    document.body.classList.toggle("narrow-layout", !wide);
    localStorage.setItem("layoutMode", wide ? "wide" : "narrow");
  });
}

function setupThumbsToggle() {
  const toggle = document.getElementById("toggleThumbs");
  if (!toggle) return;

  let saved = localStorage.getItem("showThumbs");
  if (saved === null) {
    saved = "true";
    localStorage.setItem("showThumbs", "true");
  }
  toggle.checked = saved === "true";

  toggle.addEventListener("change", () => {
    localStorage.setItem("showThumbs", toggle.checked ? "true" : "false");
    buildTableHeader();
    renderTable(true);
  });
}
function isThumbsShown() {
  return (localStorage.getItem("showThumbs") ?? "true") === "true";
}

/* ===== Utilities ===== */
function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) { return escapeHTML(str).replaceAll(" ", "%20"); }
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  return Number(String(val).replace(/[, ]+/g, "")) || 0;
}
function formatCompact(n) {
  try {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
  } catch {
    const num = n || 0;
    if (num >= 1e9) return (num/1e9).toFixed(1) + "B";
    if (num >= 1e6) return (num/1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num/1e3).toFixed(1) + "K";
    return String(num);
  }
}

/* ===== Strict M/D/Y parsing (e.g., 8/9/2025 ⇒ 09 Aug 2025) with validation ===== */
function daysInMonth(y, m /* 1..12 */) {
  return new Date(y, m, 0).getDate();
}
function parseMDYStrict(val) {
  // Accepts: M/D/YYYY or MM/DD/YYYY (optionally with time HH:MM[:SS])
  const m = String(val).trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null;
  const mo = parseInt(m[1], 10);
  const d  = parseInt(m[2], 10);
  const y  = parseInt(m[3], 10);
  const hh = parseInt(m[4] || "0", 10);
  const mm = parseInt(m[5] || "0", 10);
  const ss = parseInt(m[6] || "0", 10);
  if (mo < 1 || mo > 12) return null;
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return new Date(y, mo - 1, d, hh, mm, ss);
}

/* Robust fallback ONLY for month-word formats (e.g., "10 Feb 2020") */
function parseDate(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // 1) Strict M/D/YYYY (authoritative)
  const mdy = parseMDYStrict(s);
  if (mdy) return mdy;

  // 2) Month words (e.g., "10 Feb 2020") as a lenient fallback
  if (/[a-zA-Z]/.test(s)) {
    const cleaned = s.replace(/(\d)(st|nd|rd|th)/gi, "$1");
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  }

  // 3) Otherwise, treat as invalid
  return null;
}

function formatDate(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[\s_]+/g, "");
}

/* Show only the handle part of Custom URL (text after @), fallback to clean path */
function customUrlLabel(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  const m = s.match(/@([^\/\?\#]+)/);
  if (m) return "@" + m[1];
  return s
    .replace(/^https?:\/\/(www\.)?youtube\.com\//i, "")
    .replace(/^\/+/, "");
}

/* Country → flag helpers (emoji; no images). Expect ISO-2 codes like US, IN, CA. */
function toISO2(code) {
  if (!code) return "";
  const s = String(code).trim().toUpperCase();
  if (s === "UK") return "GB";              // alias
  return /^[A-Z]{2}$/.test(s) ? s : "";
}
function flagEmojiFromISO2(cc) {
  if (!cc) return "";
  const A = 0x1F1E6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

/* Tiny CSV parser (handles quotes, commas, newlines) */
function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; i++; continue; }
    if (c === "\r") { i++; continue; }

    field += c; i++;
  }
  row.push(field); rows.push(row);
  return rows;
}

/* ===== Column mapping ===== */
const HEADER_SYNONYMS = {
  "channelname": "channel_name",
  "channelid": "channel_id",
  "customurl": "custom_url",
  "customurl.": "custom_url",

  "subscribers": "subscribers",
  "views": "views",
  "videos": "videos",

  "channeltype": "channel_type",
  "country": "country",
  "created": "created",

  "description": "description",
  "descroption": "description",

  "profileimage": "profile_image",
  "profile_image": "profile_image",

  "fallbackimageurl": "fallback_image_url",
  "fallback_image_url": "fallback_image_url"
};

const DISPLAY_ORDER = [
  "profile_image",
  "channel_name",
  "subscribers",
  "views",
  "videos",
  "channel_type",
  "country",
  "created",
  "description",
  "custom_url"
];
const DISPLAY_LABELS = {
  profile_image: "Profile",
  channel_name: "Channel Name",
  subscribers: "Subscribers",
  views: "Views",
  videos: "Videos",
  channel_type: "Channel Type",
  country: "Country",
  created: "Created",
  description: "Description",
  custom_url: "Visit Channel"
};

/* ===== Fetch + bootstrap ===== */
window.onload = async () => {
  initTheme();
  initLayoutToggle();
  setupThemeToggle();
  setupLayoutToggle();
  setupThumbsToggle();
  hidePaginationUI(); // hide any leftover buttons/containers

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    const csvText = await res.text();
    setLastUpdatedFromHeaders(res.headers);

    const rows = parseCSV(csvText);
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    // build header map
    const headerMap = {};
    headers.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      const key = HEADER_SYNONYMS[norm] || norm;
      headerMap[key] = idx;
    });

    // build data
    allRows = dataRows
      .filter(r => r.some(cell => String(cell).trim() !== "")) // drop empty rows
      .map(r => {
        const get = (key, fallbackKeys = []) => {
          if (headerMap[key] !== undefined) return r[headerMap[key]] ?? "";
          for (const alt of fallbackKeys) {
            if (headerMap[alt] !== undefined) return r[headerMap[alt]] ?? "";
          }
          return "";
        };

        const channelName = get("channel_name");
        const channelId   = get("channel_id");
        const customUrl   = get("custom_url");

        const subs  = toNumber(get("subscribers"));
        const views = toNumber(get("views"));
        const vids  = toNumber(get("videos"));

        const createdRaw = get("created");
        const createdDate = parseDate(createdRaw); // STRICT M/D/Y first

        // description supports either "Description" or "Descroption"
        const description = get("description", []);

        // images
        const profileRaw = get("profile_image");
        const fallbackImg = get("fallback_image_url");
        const profileUrl = resolveProfileImage(profileRaw);

        return {
          channel_name: channelName,
          channel_id: channelId,
          custom_url: customUrl,
          subscribers: subs,
          views: views,
          videos: vids,
          channel_type: get("channel_type"),
          country: get("country"),
          created: createdDate ? createdDate.toISOString() : createdRaw || "",
          _createdDate: createdDate || null, // for sorting
          description: description,
          profile_image: profileUrl,
          fallback_image_url: fallbackImg
        };
      });

    // Build search index
    if (window.Fuse) {
      fuse = new Fuse(allRows, {
        threshold: 0.32,
        ignoreLocation: true,
        keys: ["channel_name", "description", "channel_type", "custom_url"]
      });
    }

    // Populate filters
    populateChannelTypeOptions(allRows);

    // initial view
    activeRows = allRows.slice();
    buildTableHeader();
    renderTable(true);
    setupSearchAndFilters();
    updateRowCount(); // initial text

  } catch (err) {
    console.error("Failed to load CSV:", err);
    const lu = document.getElementById("last-updated");
    if (lu) lu.textContent = `Last Updated: unknown`;
    const tbody = getTBody();
    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="10">Could not load CSV</td>`;
      tbody.appendChild(tr);
    }
  }

  setupScrollToTop();
};

/* ===== Resolve local/remote profile image ===== */
function resolveProfileImage(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s; // full URL
  return `Profile_Images/${s}`;          // treat as filename in /Profile_Images/
}

/* ===== Header + render ===== */
function buildTableHeader() {
  const theadRow = document.getElementById("header-row");
  if (!theadRow) return;

  const thumbs = isThumbsShown();
  theadRow.innerHTML = "";

  DISPLAY_ORDER.forEach(key => {
    if (!thumbs && key === "profile_image") return; // drop column if thumbs off
    const th = document.createElement("th");
    th.textContent = DISPLAY_LABELS[key];
    th.dataset.key = key;
    th.classList.add(`col-${key}`);     // column-specific class on header
    th.style.cursor = "pointer";
    th.addEventListener("click", () => sortBy(key, th));
    theadRow.appendChild(th);
  });
}

function getTBody() {
  return document.getElementById("table-body") || document.getElementById("video-body");
}

function renderTable(reset = true) {
  const tbody = getTBody();
  if (!tbody) return;

  if (reset) {
    tbody.innerHTML = "";
  }

  const thumbs = isThumbsShown();
  let index = 0;

  function renderChunk() {
    const end = Math.min(index + CHUNK_SIZE, activeRows.length);
    for (let i = index; i < end; i++) {
      const row = activeRows[i];
      const tr = document.createElement("tr");
      const cells = [];

      if (thumbs) {
        const img = new Image();
        img.src = row.profile_image || row.fallback_image_url || "";
        img.alt = "Profile";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
          if (row.fallback_image_url && img.src !== row.fallback_image_url) {
            img.src = row.fallback_image_url;
          }
        };
        const td = document.createElement("td");
        td.className = "thumbnail-cell";
        td.classList.add("col-profile_image");
        td.appendChild(img);
        cells.push(td);
      }

      // Channel Name (link)
      const nameTd = document.createElement("td");
      const link = document.createElement("a");
      const href = row.custom_url
        ? row.custom_url
        : (row.channel_id ? `https://www.youtube.com/channel/${escapeAttr(row.channel_id)}` : "#");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = row.channel_name || "";
      nameTd.appendChild(link);
      nameTd.classList.add("col-channel_name");
      cells.push(nameTd);

      // Subscribers / Views / Videos
      const subsTd = document.createElement("td");
      subsTd.textContent = formatCompact(row.subscribers);
      subsTd.classList.add("col-subscribers");

      const viewsTd = document.createElement("td");
      viewsTd.textContent = formatCompact(row.views);
      viewsTd.classList.add("col-views");

      const vidsTd  = document.createElement("td");
      vidsTd.textContent  = formatCompact(row.videos);
      vidsTd.classList.add("col-videos");

      cells.push(subsTd, viewsTd, vidsTd);

      // Channel Type
      const typeTd = document.createElement("td");
      typeTd.textContent = row.channel_type || "";
      typeTd.classList.add("col-channel_type");
      cells.push(typeTd);

      // Country (code then flag)
      const countryTd = document.createElement("td");
      const rawCountry = (row.country || "").trim();
      const cc = toISO2(rawCountry);           // only accept ISO-2 (UK→GB)
      const flag = flagEmojiFromISO2(cc);
      countryTd.textContent = cc ? `${cc} ${flag}` : rawCountry;
      countryTd.title = rawCountry || cc;
      countryTd.classList.add("col-country");
      cells.push(countryTd);

      // Created (pretty)
      const createdTd = document.createElement("td");
      createdTd.textContent = row._createdDate ? formatDate(row._createdDate) : (row.created || "");
      createdTd.classList.add("col-created");
      cells.push(createdTd);

      // Description
      const descTd = document.createElement("td");
      descTd.textContent = row.description || "";
      descTd.classList.add("col-description");
      cells.push(descTd);

      // Visit Channel (handle only; title shows full URL)
      const urlTd = document.createElement("td");
      if (row.custom_url) {
        const a = document.createElement("a");
        a.href = row.custom_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = customUrlLabel(row.custom_url);
        a.title = row.custom_url; // tooltip with full URL
        urlTd.appendChild(a);
      } else {
        urlTd.textContent = "";
      }
      urlTd.classList.add("col-custom_url");
      cells.push(urlTd);

      for (const td of cells) tr.appendChild(td);
      tbody.appendChild(tr);
    }

    index = end;
    updateRowCount(index, activeRows.length);

    if (index < activeRows.length) {
      rIC(renderChunk); // schedule next chunk during idle time
    }
  }

  renderChunk();
}

/* ===== Sorting ===== */
function sortBy(key, thEl) {
  // remove arrows
  const headerRow = document.getElementById("header-row");
  if (headerRow) {
    headerRow.querySelectorAll("th").forEach(th => {
      th.textContent = th.textContent.replace(/[\u2191\u2193]$/, "");
    });
  }

  if (currentSortKey === key) {
    currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
  } else {
    currentSortKey = key;
    currentSortDir = "asc";
  }

  if (thEl) thEl.textContent = DISPLAY_LABELS[key] + (currentSortDir === "asc" ? "↑" : "↓");

  const dir = currentSortDir === "asc" ? 1 : -1;

  activeRows.sort((a, b) => {
    let x, y;

    switch (key) {
      case "channel_name":
      case "channel_type":
      case "country":
      case "description":
      case "custom_url":
        x = (a[key] || "").toLowerCase(); y = (b[key] || "").toLowerCase();
        break;
      case "subscribers":
      case "views":
      case "videos":
        x = a[key] || 0; y = b[key] || 0;
        break;
      case "created":
        x = a._createdDate ? a._createdDate.getTime() : 0;
        y = b._createdDate ? b._createdDate.getTime() : 0;
        break;
      case "profile_image":
        x = a.profile_image || ""; y = b.profile_image || "";
        break;
      default:
        x = (a[key] || ""); y = (b[key] || "");
    }
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return 0;
  });

  renderTable(true);
}

/* ===== Search + Filters ===== */
function populateChannelTypeOptions(rows) {
  const sel = document.getElementById("channelType") || document.getElementById("videoType");
  if (!sel) return;
  const types = Array.from(new Set(rows.map(r => (r.channel_type || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">All Types</option>` + types.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("searchInput");
  const minViews = document.getElementById("minViews");
  const minVideos = document.getElementById("minVideos") || document.getElementById("minDuration");
  const typeSelect = document.getElementById("channelType") || document.getElementById("videoType");

  function filterAndRender() {
    const q = (searchInput?.value || "").trim();
    const minViewsVal = parseInt(minViews?.value || "0", 10) || 0;
    const minVideosVal = parseInt(minVideos?.value || "0", 10) || 0;
    const typeVal = (typeSelect?.value || "").trim();

    isSearching = Boolean(q) || minViewsVal > 0 || minVideosVal > 0 || Boolean(typeVal);

    // search
    const base = q
      ? (fuse ? fuse.search(q).map(r => r.item) : allRows.filter(r =>
          (r.channel_name || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.description || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.channel_type || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.custom_url || "").toLowerCase().includes(q.toLowerCase())
        ))
      : allRows;

    // filter
    activeRows = base.filter(r =>
      (r.views  || 0) >= minViewsVal &&
      (r.videos || 0) >= minVideosVal &&
      (typeVal === "" || (r.channel_type || "").trim() === typeVal)
    );

    buildTableHeader();
    renderTable(true);
  }

  searchInput?.addEventListener("input", filterAndRender);
  minViews?.addEventListener("change", filterAndRender);
  minVideos?.addEventListener("change", filterAndRender);
  typeSelect?.addEventListener("change", filterAndRender);
}

/* ===== Counts + last updated ===== */
function updateRowCount(rendered = null, matched = null) {
  const total = allRows.length;
  const match = matched ?? activeRows.length;
  const shown = rendered ?? Math.min(match, CHUNK_SIZE);
  const el = document.getElementById("video-count");
  if (el) {
    const still = shown < match ? ` (rendering… ${shown}/${match})` : "";
    el.innerHTML = `Total Rows: ${total}<br>Showing ${Math.min(shown, match)} of ${match}${still}`;
  }
}
function setLastUpdatedFromHeaders(headers) {
  const lu = document.getElementById("last-updated");
  if (!lu) return;
  const lm = headers.get("last-modified");
  if (lm) {
    const d = new Date(lm);
    lu.textContent = `Last Updated: ${d.toLocaleDateString()}`;
  } else {
    lu.textContent = `Last Updated: unknown`;
  }
}

/* ===== Scroll to top ===== */
function setupScrollToTop() {
  let btn = document.getElementById("scrollTopBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.textContent = "↑";
    btn.title = "Back to Top";
    btn.id = "scrollTopBtn";
    document.body.appendChild(btn);
  }
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => {
    btn.style.display = window.scrollY > 200 ? "block" : "none";
  });
}

/* ===== Hide old pagination UI if it exists ===== */
function hidePaginationUI() {
  const c = document.getElementById("load-more-container");
  if (c) c.style.display = "none";
  const more = document.getElementById("loadMoreBtn");
  const all = document.getElementById("loadAllBtn");
  if (more) more.style.display = "none";
  if (all) all.style.display = "none";
}

