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
  let switching = true, dir = "asc", switchcount = 0;

  while (switching) {
    switching = false;
    const rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      const x = rows[i].getElementsByTagName("TD")[n];
      const y = rows[i + 1].getElementsByTagName("TD")[n];
      const xVal = isNaN(x.innerText) ? x.innerText.toLowerCase() : parseInt(x.innerText.replace(/,/g, ''));
      const yVal = isNaN(y.innerText) ? y.innerText.toLowerCase() : parseInt(y.innerText.replace(/,/g, ''));
      if ((dir === "asc" && xVal > yVal) || (dir === "desc" && xVal < yVal)) {
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
