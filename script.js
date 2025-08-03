let allVideos = [];
let fuse = null;
let currentSortColumn = null;
let currentSortDirection = "asc";
let videosPerPage = 50;
let currentIndex = 0;
let lastShownCount = videosPerPage;
let activeList = [];
let isSearching = false;

window.onload = () => {
  fetch("videos.json")
    .then(res => res.json())
    .then(videoData => {
      allVideos = videoData;

      fuse = new Fuse(videoData, {
        keys: ['title', 'channel', 'upload_date'],
        threshold: 0.3,
        ignoreLocation: true
      });

      activeList = allVideos;
      renderTable(true, lastShownCount);
      setupSearchAndFilters();
      setupToggle();
      setupLoadMore();
      setupLoadAll();
      updateVideoCount();
    });

  fetch("https://api.github.com/repos/OnlineRender-Dev/Octane_Database/commits?path=videos.json")
    .then(res => res.json())
    .then(data => {
      const lastCommit = data[0];
      const dateStr = new Date(lastCommit.commit.committer.date).toLocaleDateString();
      document.getElementById("last-updated").textContent = `Last Updated: ${dateStr}`;
    })
    .catch(() => {
      document.getElementById("last-updated").textContent = `Last Updated: unknown`;
    });

  setupScrollToTop();
};

function renderTable(reset = false, limit = videosPerPage) {
  const tbody = document.getElementById('video-body');
  if (reset) {
    tbody.innerHTML = '';
    currentIndex = 0;
  }

  const nextBatch = activeList.slice(currentIndex, currentIndex + limit);
  nextBatch.forEach(video => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="thumbnail-cell">
        <img loading="lazy" src="${video.thumbnail}" alt="Thumbnail"
          onerror="this.onerror=null; this.src='${video.fallback_thumbnail || "thumbs/default.jpg"}';" />
      </td>
      <td>${video.title}</td>
      <td>${video.channel}</td>
      <td>${video.views.toLocaleString()}</td>
      <td>${video.duration}</td>
      <td>${video.upload_date}</td>
      <td><a href="${video.url}" target="_blank">Watch</a></td>
    `;
    tbody.appendChild(tr);
  });

  currentIndex += limit;
  if (!isSearching) lastShownCount = currentIndex;

  const loadMoreBtn = document.getElementById("loadMoreBtn");
  loadMoreBtn.style.display = currentIndex >= activeList.length ? "none" : "inline-block";

  updateVideoCount();
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("searchInput");
  const minViews = document.getElementById("minViews");
  const minDuration = document.getElementById("minDuration");

  function filterAndRender() {
    const query = searchInput.value.trim();
    const minViewsVal = parseInt(minViews.value) || 0;
    const minDurationVal = parseInt(minDuration.value) || 0;

    const listToFilter = query === "" ? allVideos : fuse.search(query).map(r => r.item);
    isSearching = query !== "";

    activeList = listToFilter.filter(video =>
      video.views >= minViewsVal &&
      durationToSeconds(video.duration) >= minDurationVal
    );

    renderTable(true, videosPerPage);
  }

  searchInput.addEventListener("input", filterAndRender);
  minViews.addEventListener("change", filterAndRender);
  minDuration.addEventListener("change", filterAndRender);
}

function setupToggle() {
  document.getElementById("toggleThumbs").addEventListener("change", function () {
    document.body.classList.toggle("hide-thumbnails", !this.checked);
  });
}

function setupLoadMore() {
  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    renderTable(false, videosPerPage);
  });
}

function setupLoadAll() {
  document.getElementById("loadAllBtn").addEventListener("click", () => {
    renderTable(true, activeList.length);
  });
}

function sortTable(n, headerId) {
  const table = document.getElementById("video-table");
  const headers = table.querySelectorAll("th");

  headers.forEach(h => {
    if (h.id) h.innerText = h.innerText.replace(/[\u2191\u2193]/g, '').trim();
  });

  if (currentSortColumn === n) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = n;
    currentSortDirection = "asc";
  }

  const header = document.getElementById(headerId);
  header.innerText += currentSortDirection === "asc" ? " ↑" : " ↓";

  activeList.sort((a, b) => {
    let x, y;
    if (n === 3) {
      x = a.views || 0; y = b.views || 0;
    } else if (n === 4) {
      x = durationToSeconds(a.duration); y = durationToSeconds(b.duration);
    } else if (n === 5) {
      x = new Date(a.upload_date); y = new Date(b.upload_date);
    } else if (n === 1) {
      x = a.title.toLowerCase(); y = b.title.toLowerCase();
    } else if (n === 2) {
      x = a.channel.toLowerCase(); y = b.channel.toLowerCase();
    }
    return (x < y ? -1 : x > y ? 1 : 0) * (currentSortDirection === "asc" ? 1 : -1);
  });

  renderTable(true, isSearching ? videosPerPage : lastShownCount);
}

function durationToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(parts[0]) || 0;
}

function updateVideoCount() {
  const total = allVideos.length;
  const shown = Math.min(currentIndex, activeList.length);
  document.getElementById("video-count").innerHTML = `
    Total Tutorials in Database: ${total}<br>
    Showing ${shown} of ${activeList.length}
  `;
}

function setupScrollToTop() {
  const btn = document.createElement("button");
  btn.textContent = "↑";
  btn.title = "Back to Top";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = "1000";
  btn.style.padding = "8px 12px";
  btn.style.backgroundColor = "#333";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.fontSize = "18px";
  btn.style.cursor = "pointer";
  btn.style.display = "none";

  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    btn.style.display = window.scrollY > 200 ? "block" : "none";
  });
}
