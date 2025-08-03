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

  // Remove arrows from all headers
  headers.forEach(h => {
    if (h.id) h.innerText = h.innerText.replace(/[\u2191\u2193]/g, '').trim();
  });

  // Toggle direction if same column, otherwise default to ascending
  if (currentSortColumn === n) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortColumn = n;
    currentSortDirection = "asc";
  }

  // Add arrow to current header
  const header = document.getElementById(headerId);
  const arrow = currentSortDirection === "asc" ? " ↑" : " ↓";
  header.innerText = header.innerText.trim() + arrow;

  let switching = true;
  while (switching) {
    switching = false;
    const rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      const x = rows[i].getElementsByTagName("TD")[n];
      const y = rows[i + 1].getElementsByTagName("TD")[n];
      let xVal = x.innerText.trim();
      let yVal = y.innerText.trim();

      // Convert for numeric, date, or duration
      if (n === 3) { // Views
        xVal = parseInt(xVal.replace(/,/g, ""));
        yVal = parseInt(yVal.replace(/,/g, ""));
      } else if (n === 4) { // Duration
        xVal = durationToSeconds(xVal);
        yVal = durationToSeconds(yVal);
      } else if (n === 5) { // Upload Date
        xVal = new Date(xVal);
        yVal = new Date(yVal);
      } else {
        xVal = xVal.toLowerCase();
        yVal = yVal.toLowerCase();
      }

      const compare = currentSortDirection === "asc" ? xVal > yVal : xVal < yVal;
      if (compare) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        break;
      }
    }
  }
}

function durationToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(parts[0]) || 0;
}
