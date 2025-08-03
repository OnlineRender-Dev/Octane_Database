fetch('videos.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('video-body');
    data.forEach(video => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${video.thumbnail}" alt="Thumbnail" /></td>
        <td>${video.title}</td>
        <td>${video.channel}</td>
        <td>${video.views.toLocaleString()}</td>
        <td>${video.duration}</td>
        <td>${video.upload_date}</td>
        <td><a href="${video.url}" target="_blank">Watch</a></td>
      `;
      tbody.appendChild(tr);
    });
  })
  .catch(err => {
    document.getElementById('video-body').innerHTML =
      `<tr><td colspan="7">Failed to load videos.</td></tr>`;
    console.error("Error loading videos.json", err);
  });

let currentSortColumn = null;
let currentSortDirection = "asc";

function sortTable(n, headerId) {
  const table = document.getElementById("video-table");
  const headers = table.querySelectorAll("th");

  // Remove all arrows
  headers.forEach(h => {
    if (h.id) {
      h.innerText = h.innerText.replace(/[\u2191\u2193]/g, '').trim();
    }
  });

  // Decide sort direction
  if (currentSortColumn === n) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = n;
    currentSortDirection = "asc"; // Always start ascending for a new column
  }

  // Apply arrow immediately
  const header = document.getElementById(headerId);
  const arrow = currentSortDirection === "asc" ? " ↑" : " ↓";
  header.innerText = header.innerText.trim() + arrow;

  // Sort rows
  const rows = Array.from(table.rows).slice(1); // Skip header row
  rows.sort((a, b) => {
    let x = a.cells[n].innerText.trim();
    let y = b.cells[n].innerText.trim();

    if (n === 3) { // Views
      x = parseInt(x.replace(/,/g, ''));
      y = parseInt(y.replace(/,/g, ''));
    } else if (n === 4) { // Duration
      x = durationToSeconds(x);
      y = durationToSeconds(y);
    } else if (n === 5) { // Upload date
      x = new Date(x);
      y = new Date(y);
    } else {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }

    if (x < y) return currentSortDirection === "asc" ? -1 : 1;
    if (x > y) return currentSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Reattach sorted rows
  const tbody = table.tBodies[0];
  rows.forEach(row => tbody.appendChild(row));
}

function durationToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(parts[0]) || 0;
}
