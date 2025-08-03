let allVideos = [];
let fuse = null;
let currentSortColumn = null;
let currentSortDirection = "asc";
let videosPerPage = 50;
let currentIndex = 0;
let lastShownCount = videosPerPage;
let activeList = [];
let isSearching = false;

document.addEventListener("DOMContentLoaded", () => {
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
      setupScrollToTop();
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
});

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
      <td class="thumbnail-cell"><img loading="lazy" src="${video.thumbnail}" alt="Thumbnail" /></td>
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

  if (!isSearching) {
    lastShownCount = currentIndex;
  }

  const loadMoreBtn = document.getElementById("loadMoreBtn");
  loadMoreBtn.style.display = currentIndex >= activeList.length ? "none" : "inline-block";

  updateVideoCount();
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("searchInput");
  const minDurationInput = document.getElementById("minDuration");
  const minViewsInput = document.getElementById("minViews");

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const minViews = parseInt(minViewsInput.value) || 0;
    const minDuration = parseInt(minDurationInput.value) || 0;

    let filtered = allVideos.filter(video => {
      const viewsOK = (video.views || 0) >= minViews;
      const durationOK = durationToSeconds(video.duration) >= minDuration;
      return viewsOK && durationOK;
    });

    if (query !== "") {
      const searchResults = fuse.search(query).map(result => result.item);
      filtered = filtered.filter(v => searchResults.includes(v));
      isSearching = true;
    } else {
      isSearching = false;
    }

    activeList = filtered;
    renderTable(true, videosPerPage);
  }

  [searchInput, minDurationInput, minViewsInput].forEach(input => {
    input.addEventListener("change", applyFilters);
    input.addEventListener("input", applyFilters);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") applyFilters();
    });
  });
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

  document.getElementById("loadAllBtn").addEventListener("click", () => {
    renderTable(false, activeList.length - currentIndex);
  });
}

function sortTable(n, headerId) {
  const table = document.getElementById("video-table");
  const headers = table.querySelectorAll("th");

  headers.forEach(h => {
    if (h.id) {
      h.innerText = h.innerText.replace(/[\u2191\u2193]/g, '').trim();
    }
  });

  if (currentSortColumn === n) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = n;
    currentSortDirection = "asc";
  }

  const header = document.getElementById(headerId);
  const arrow = currentSortDirection === "asc" ? " ↑" : " ↓";
  header.innerText = header.innerText.trim() + arrow;

  activeList.sort((a, b) => {
    let x, y;

    if (n === 3) {
      x = a.views || 0;
      y = b.views || 0;
    } else if (n === 4) {
      x = durationToSeconds(a.duration);
      y = durationToSeconds(b.duration);
    } else if (n === 5) {
      x = new Date(a.upload_date);
      y = new Date(b.upload_date);
    } else if (n === 1) {
      x = a.title.toLowerCase();
      y = b.title.toLowerCase();
    } else if (n === 2) {
      x = a.channel.toLowerCase();
      y = b.channel.toLowerCase();
    }

    if (x < y) return currentSortDirection === "asc" ? -1 : 1;
    if (x > y) return currentSortDirection === "asc" ? 1 : -1;
    return 0;
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
  const shown = Math.min(currentIndex, activeList.length);
  const total = allVideos.length;
  const counter = document.getElementById("video-count");
  if (counter) {
    counter.innerHTML = `
      Total Tutorials in Database: <strong>${total}</strong><br>
      Showing <strong>${shown}</strong> of <strong>${activeList.length}</strong>
    `;
  }
}

function setupScrollToTop() {
  const scrollBtn = document.getElementById("scrollTopBtn");
  if (!scrollBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      scrollBtn.style.display = "block";
    } else {
      scrollBtn.style.display = "none";
    }
  });

  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
