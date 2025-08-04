window.onload = () => {
  fetch("videos.json")
    .then(res => res.json())
    .then(data => {
      displayVideos(data);
    })
    .catch(err => {
      console.error("Failed to load videos:", err);
      document.getElementById("video-list").innerHTML = "<p>Failed to load videos.</p>";
    });
};

function displayVideos(videos) {
  const container = document.getElementById("video-list");
  container.innerHTML = "";

  // Sort by newest upload_date descending
  videos.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));

  videos.forEach(video => {
    const card = document.createElement("div");
    card.className = "video-card";
    card.innerHTML = `
      <img src="${video.thumbnail}" alt="Thumbnail"
        onerror="this.onerror=null;this.src='${video.fallback_thumbnail || 'thumbs/default.jpg'}';">
      <div class="video-details">
        <h3>${video.title}</h3>
        <p><strong>Channel:</strong> ${video.channel}</p>
        <p><strong>Duration:</strong> ${video.duration}</p>
        <p><strong>Date:</strong> ${video.upload_date}</p>
        <p><strong>Views:</strong> ${video.views.toLocaleString()}</p>
        <a href="${video.url}" target="_blank" class="watch-btn">Watch</a>
      </div>
    `;
    container.appendChild(card);
  });
}
