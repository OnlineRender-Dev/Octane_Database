fetch('videos.json')
  .then(res => res.json())
  .then(videos => {
    const container = document.getElementById('video-container');

    videos.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date)); // Newest first

    videos.forEach(video => {
      const card = document.createElement('div');
      card.className = 'video-card';

      card.innerHTML = `
        <img src="${video.thumbnail}" alt="Thumbnail" onerror="this.src='${video.fallback_thumbnail || 'thumbs/default.jpg'}'">
        <div class="video-info">
          <h3>${video.title}</h3>
          <p><strong>Channel:</strong> ${video.channel}</p>
          <p><strong>Duration:</strong> ${video.duration}</p>
          <p><strong>Upload Date:</strong> ${video.upload_date}</p>
          <p><strong>Views:</strong> ${video.views.toLocaleString()}</p>
        </div>
      `;

      container.appendChild(card);
    });
  });
