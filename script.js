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

function sortTable(n) {
  const table = document.getElementById("video-table");
  let switching = true;
  let dir = "asc";
  let switchcount = 0;

  while (switching) {
    switching = false;
    const rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      let x = rows[i].getElementsByTagName("TD")[n];
      let y = rows[i + 1].getElementsByTagName("TD")[n];

      let xContent = x.innerText.trim();
      let yContent = y.innerText.trim();

      // Convert values for sortable types
      if (n === 3) { // Views
        xContent = parseInt(xContent.replace(/,/g, ""));
        yContent = parseInt(yContent.replace(/,/g, ""));
      } else if (n === 4) { // Duration
        xContent = durationToSeconds(xContent);
        yContent = durationToSeconds(yContent);
      } else if (n === 5) { // Upload Date
        xContent = new Date(xContent);
        yContent = new Date(yContent);
      } else {
        xContent = xContent.toLowerCase();
        yContent = yContent.toLowerCase();
      }

      if ((dir === "asc" && xContent > yContent) ||
          (dir === "desc" && xContent < yContent)) {
        shouldSwitch = true;
        break;
      }
    }

    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else if (switchcount === 0 && dir === "asc") {
      dir = "desc";
      switching = true;
    }
  }
}

function durationToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else {
    return parseInt(parts[0]) || 0;
  }
}
