fetch('videos.json')
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('video-body');
    data.forEach(video => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
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
      `<tr><td colspan="6">Failed to load videos.</td></tr>`;
    console.error("Error loading videos.json", err);
  });

function sortTable(n) {
  const table = document.getElementById("video-table");
  let switching = true, dir = "asc", switchcount = 0;

  while (switching) {
    switching = false;
    let rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      let x = rows[i].getElementsByTagName("TD")[n];
      let y = rows[i + 1].getElementsByTagName("TD")[n];
      let xVal = isNaN(x.innerText) ? x.innerText.toLowerCase() : parseInt(x.innerText.replace(/,/g, ''));
      let yVal = isNaN(y.innerText) ? y.innerText.toLowerCase() : parseInt(y.innerText.replace(/,/g, ''));
      if ((dir === "asc" && xVal > yVal) || (dir === "desc" && xVal < yVal)) {
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else {
      if (switchcount === 0 && dir === "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}
