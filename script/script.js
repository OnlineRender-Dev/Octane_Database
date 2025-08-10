// script/script.js
let allVideos = [];
let fuse = null;
let currentSortColumn = null;
let currentSortDirection = "asc";
let videosPerPage = 50;
let currentIndex = 0;
let lastShownCount = videosPerPage;
let activeList = [];
let isSearching = false;

// One-click "Load All" latch for the session
let showAllMode = false;

/* ========== Theme handling (default: dark) ========== */
function initTheme() {
  let saved = localStorage.getItem("theme");
  if (!saved) {
    saved = "dark"; // default
    localStorage.setItem("theme", "dark");
  }
  if (saved === "dark") document.body.classList.add("dark");
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = saved === "dark";
}
function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  });
}

/* ========== Layout width toggle (default: wide) ========== */
function initLayoutToggle() {
  let saved = localStorage.getItem("layoutMode");
  if (!saved) {
    saved = "wide"; // default
    localStorage.setItem("layoutMode", "wide");
  }
  if (saved === "narrow") document.body.classList.add("narrow-layout");
  const toggle = document.getElementById("layoutToggle");
  if (toggle) toggle.checked = saved === "wide";
}
function setupLayoutToggle() {
  const toggle = document.getElementById("layoutToggle");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      document.body.classList.remove("narrow-layout");
      localStorage.setItem("layoutMode", "wide");
    } else {
      document.body.classList.add("narrow-layout");
      localStorage.setItem("layoutMode", "narrow");
    }
  });
}

/* ========== Thumbnails toggle (default: ON) ========== */
function setupToggle() {
  const toggle = document.getElementById("toggleThumbs");
  if (!toggle) return;

  let saved = localStorage.getItem("showThumbs");
  if (saved === null) {
    saved = "true";
    localStorage.setItem("showThumbs", "true");
  }
  const show = saved === "true";
  document.body.classList.toggle("hide-thumbnails", !show);
  toggle.checked = show;

  toggle.addEventListener("change", function () {
    const isOn = this.checked;
    document.body.classList.toggle("hide-thumbnails", !isOn);
    localStorage.setItem("showThumbs", isOn ? "true" : "false");
  });
}

/* ===== Helpers ===== */
function durationToSeconds(timeStr) {
  const parts = String(timeStr || "").split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(parts[0], 10) || 0;
}
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHTML(str).replaceAll(" ", "%20");
}

function updateLoadButtons() {
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const loadAllBtn  = document.getElementById("loadAllBtn");
  if (showAllMode) {
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (loadAllBtn)  loadAllBtn.style.display  = "none";
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.style.display = currentIndex >= activeList.length ? "none" : "inline-block";
    }
    if (loadAllBtn) {
      loadAllBtn.style.display = "inline-block";
    }
  }
}

/* ========== App init ========== */
window.onload = () => {
  // Initialize UI preferences
  initTheme();
  initLayoutToggle();

  // Load JSON from /Data/videos.json
  fetch("Data/videos.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(videoData => {
      allVideos = (videoData || []).sort(
        (a, b) => new Date(b.upload_date) - new Date(a.upload_date)
      );

      fuse = new Fuse(allVideos, {
        keys: ["title", "channel", "upload_date"],
        threshold: 0.3,
        ignoreLocation: true
      });

      activeList = allVideos;
      renderTable(true, lastShownCount);
      setupSearchAndFilters();
      setupToggle();          // thumbnails toggle
      setupLoadMore();
      setupLoadAll();
      setupThemeToggle();     // dark mode toggle
      setupLayoutToggle();    // layout toggle
      updateVideoCount();
      updateLoadButtons();
    })
    .catch(err => {
      console.error("Failed to load Data/videos.json:", err);
      const el = document.getElementById("video-body");
      if (el) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7">Could not load Data/videos.json</td>`;
        el.appendChild(tr);
      }
      const lu = document.getElementById("last-updated");
      if (lu) lu.textContent = "Last Updated: unknown";
      setupToggle();
      setupThemeToggle();
      setupLayoutToggle();
      updateLoadButtons();
    });

  // GitHub "Last Updated"
  fetch("https://api.github.com/repos/OnlineRender-Dev/Octane_Database/commits?path=Data/videos.json")
    .then(res => res.json())
    .then(data => {
      const lu = document.getElementById("last-updated");
      if (!lu) return;
      if (Array.isArray(data) && data[0]?.commit?.committer?.date) {
        const dateStr = new Date(data[0].commit.committer.date).toLocaleDateString();
        lu.textContent = `Last Updated: ${dateStr}`;
      } else {
        lu.textContent = `Last Updated: unknown`;
      }
    })
    .catch(() => {
      const lu = document.getElementById("last-updated");
      if (lu) lu.textContent = `Last Updated: unknown`;
    });

  setupScrollToTop();
};

function renderTable(reset = false, limit = videosPerPage) {
  const tbody = document.getElementById("video-body");
  const statusEl = document.getElementById("thumb-status");

  if (reset) {
    tbody.innerHTML = "";
    currentIndex = 0;
  }

  // Force "show all" when latched OR when actively searching/filtering
  const effectiveLimit = (showAllMode || isSearching) ? activeList.length : limit;

  const nextBatch = activeList.slice(currentIndex, currentIndex + effectiveLimit);
  let loadedCount = 0;
  const totalCount = nextBatch.length;

  // Suppress the "Loading thumbnails" counter in showAllMode
  if (!showAllMode && statusEl) {
    statusEl.textContent = `Loading thumbnails: 0 / ${totalCount}`;
  }

  nextBatch.forEach(video => {
    const tr = document.createElement("tr");

    const img = new Image();
    img.src = video.thumbnail || video.fallback_thumbnail || "thumbs/default.jpg";
    img.alt = "Thumbnail";
    img.onerror = () => {
      img.onerror = null;
      img.src = video.fallback_thumbnail || "thumbs/default.jpg";
    };
    img.onload = img.onerror = () => {
      loadedCount++;
      if (!showAllMode && statusEl) {
        statusEl.textContent = `Loading thumbnails: ${loadedCount} / ${totalCount}`;
        if (loadedCount === totalCount) {
          setTimeout(() => { statusEl.textContent = ""; }, 800);
        }
      }
    };

    img.style.maxWidth = "100%";
    img.style.borderRadius = "4px";

    tr.innerHTML = `
      <td class="thumbnail-cell"></td>
      <td>${escapeHTML(video.title || "")}</td>
      <td>${escapeHTML(video.channel || "")}</td>
      <td>${Number(video.views || 0).toLocaleString()}</td>
      <td>${escapeHTML(video.duration || "")}</td>
      <td>${escapeHTML(video.upload_date || "")}</td>
      <td><a href="${escapeAttr(video.url || "#")}" target="_blank" rel="noopener noreferrer">Watch</a></td>
    `;

    tr.querySelector(".thumbnail-cell").appendChild(img);
    tbody.appendChild(tr);
  });

  currentIndex += effectiveLimit;
  if (!isSearching && !showAllMode) lastShownCount = currentIndex;

  updateVideoCount();
  updateLoadButtons();
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("searchInput");
  const minViews = document.getElementById("minViews");
  const minDuration = document.getElementById("minDuration");

  function filterAndRender() {
    const query = (searchInput.value || "").trim();
    const minViewsVal = parseInt(minViews.value, 10) || 0;
    const minDurationVal = parseInt(minDuration.value, 10) || 0;

    // Any filter or query counts as searching
    isSearching = query !== "" || minViewsVal > 0 || minDurationVal > 0;

    const listToFilter = query === "" ? allVideos : fuse.search(query).map(r => r.item);

    activeList = listToFilter.filter(video =>
      (video.views || 0) >= minViewsVal &&
      durationToSeconds(video.duration) >= minDurationVal
    );

    // If showAllMode or searching, show all; else paginate
    const limit = (showAllMode || isSearching) ? activeList.length : videosPerPage;

    renderTable(true, limit);
    lastShownCount = limit;
  }

  searchInput.addEventListener("input", filterAndRender);
  minViews.addEventListener("change", filterAndRender);
  minDuration.addEventListener("change", filterAndRender);
}

function setupLoadMore() {
  const btn = document.getElementById("loadMoreBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // Only meaningful if not in showAllMode and not searching
    if (showAllMode || isSearching) return;
    renderTable(false, videosPerPage);
  });
}

function setupLoadAll() {
  const btn = document.getElementById("loadAllBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // Latch: always show all from now on; hide counters & buttons
    showAllMode = true;
    renderTable(true, activeList.length);
    updateLoadButtons();
  });
}

function sortTable(n, headerId) {
  const table = document.getElementById("video-table");
  if (!table) return;

  const headers = table.querySelectorAll("th");
  headers.forEach(h => {
    if (h.id) h.innerText = h.innerText.replace(/[\u2191\u2193]/g, "").trim();
  });

  if (currentSortColumn === n) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = n;
    currentSortDirection = "asc";
  }

  const header = document.getElementById(headerId);
  if (header) header.innerText += currentSortDirection === "asc" ? " ↑" : " ↓";

  activeList.sort((a, b) => {
    let x, y;
    if (n === 3) {
      x = a.views || 0; y = b.views || 0;
    } else if (n === 4) {
      x = durationToSeconds(a.duration); y = durationToSeconds(b.duration);
    } else if (n === 5) {
      x = new Date(a.upload_date); y = new Date(b.upload_date);
    } else if (n === 1) {
      x = (a.title || "").toLowerCase(); y = (b.title || "").toLowerCase();
    } else if (n === 2) {
      x = (a.channel || "").toLowerCase(); y = (b.channel || "").toLowerCase();
    }
    return (x < y ? -1 : x > y ? 1 : 0) * (currentSortDirection === "asc" ? 1 : -1);
  });

  // Keep everything visible if showAllMode or searching
  renderTable(true, (showAllMode || isSearching) ? activeList.length : lastShownCount);
}

function updateVideoCount() {
  const total = allVideos.length;
  const shown = Math.min(currentIndex, activeList.length);
  const el = document.getElementById("video-count");
  if (el) {
    el.innerHTML = `Total Tutorials in Database: ${total}<br>Showing ${shown} of ${activeList.length}`;
  }
}

function setupScrollToTop() {
  let btn = document.getElementById("scrollTopBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.textContent = "↑";
    btn.title = "Back to Top";
    btn.id = "scrollTopBtn";
    document.body.appendChild(btn);
  }

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    btn.style.display = window.scrollY > 200 ? "block" : "none";
  });
}
