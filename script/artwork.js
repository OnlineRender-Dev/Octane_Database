(function () {
  const ARTWORK_DIR = 'artwork';
  const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];

  // Batching
  const PAGE_SIZE = 12; // thumbnails per batch
  let currentCount = PAGE_SIZE;

  // Google Sheet (must be shared: Anyone with the link – Viewer)
  const SHEET_ID = '1sgfuWWmpqCxzhByjZvIGK-aekD5b3VtCFRrxEYupH0M';
  const SHEET_JSON_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

  // DOM
  const galleryEl = document.getElementById('gallery');
  const template = document.getElementById('thumbTemplate');
  const totalAllEl = document.getElementById('totalAll');
  const totalImagesEl = document.getElementById('totalImages');
  const totalVideosEl = document.getElementById('totalVideos');
  const captionsToggle = document.getElementById('captionsToggle');
  const typeFilter = document.getElementById('typeFilter');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  // Lightbox
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImage');
  const lbCaption = document.getElementById('lbCaption');
  const lbClose = document.getElementById('lbClose');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');

  let items = [];   // full dataset
  let view = [];    // filtered dataset
  let currentIndex = -1; // index within visible slice

  const hasImageExt = (name) => IMAGE_EXTS.some(ext => name?.toLowerCase().endsWith(ext));
  const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ── URL → embed (YouTube/Vimeo)
  function toEmbedUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, '').toLowerCase();

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
        if (host === 'youtu.be') {
          const id = u.pathname.slice(1);
          return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
        }
        if (u.pathname.startsWith('/watch')) {
          const id = u.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
        }
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.split('/')[2];
          return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
        }
        if (u.pathname.startsWith('/embed/')) {
          return `${u.origin}${u.pathname}?autoplay=1&rel=0`;
        }
      }

      if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        let id = null;
        if (host === 'vimeo.com') id = parts[0];
        else if (parts[0] === 'video') id = parts[1];
        return id ? `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0` : null;
      }

      return null;
    } catch { return null; }
  }

  // ── Lightbox iframe manager
  function ensureLbFrame(embedUrl) {
    let frame = document.getElementById('lbFrame');
    if (!embedUrl) { if (frame) frame.remove(); return null; }
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'lbFrame';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen = true;
      frame.style.width = '92vw';
      frame.style.maxWidth = '1200px';
      frame.style.aspectRatio = '16 / 9';
      frame.style.border = '0';
      lb.insertBefore(frame, lbCaption);
    }
    frame.src = embedUrl;
    return frame;
  }

  // ── Load & parse Google Sheet (supports header-in-first-row)
  async function loadFromSheet() {
    try {
      const res = await fetch(SHEET_JSON_URL, { cache: 'no-store' });
      const text = await res.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('GViz wrapper not found');
      const json = JSON.parse(text.slice(start, end + 1));

      const raw = (json.table.rows || []).map(r => (r.c || []).map(c => (c ? String(c.v ?? '').trim() : '')));
      if (!raw.length) return [];

      const header = raw[0].map(v => v.toLowerCase().replace(/\s+/g, ' ').trim());
      const headerLooksOK =
        header.includes('title') &&
        (header.includes('artist') || header.includes('artists') || header.includes('aritsts')) &&
        header.includes('link') &&
        (header.includes('image file') || header.includes('image'));

      let rows = raw;
      let idx = { title:-1, artist:-1, link:-1, image:-1, type:-1, video:-1, featured:-1 };

      if (headerLooksOK) {
        idx.title    = header.findIndex(v => v === 'title');
        idx.artist   = header.findIndex(v => v === 'artist' || v === 'artists' || v === 'aritsts');
        idx.link     = header.findIndex(v => v === 'link');
        idx.image    = header.findIndex(v => v === 'image file' || v === 'image');
        idx.type     = header.findIndex(v => v === 'artwork type' || v === 'type');
        idx.video    = header.findIndex(v => v === 'video url' || v === 'video');
        idx.featured = header.findIndex(v => v === 'featured');
        rows = raw.slice(1);
      } else {
        const cols = (json.table.cols || []).map(c => (c.label || '').toLowerCase().replace(/\s+/g, ' ').trim());
        idx.title    = cols.findIndex(c => /\btitle\b/.test(c));
        idx.artist   = cols.findIndex(c => /\bartist(s)?\b/.test(c));
        idx.link     = cols.findIndex(c => /^link$/.test(c));
        idx.image    = cols.findIndex(c => /image\s*file|^image$/.test(c));
        idx.type     = cols.findIndex(c => /artwork\s*type|^type$/.test(c));
        idx.video    = cols.findIndex(c => /video\s*url|^video$/.test(c));
        idx.featured = cols.findIndex(c => /^featured$/.test(c));
      }

      const list = rows
        .map(r => {
          const name = idx.image >= 0 ? (r[idx.image] || '') : '';
          const typeRaw = idx.type >= 0 ? (r[idx.type] || '') : '';
          const artworkType = typeRaw.toLowerCase().trim() === 'video' ? 'video' : 'image';

          const videoUrl = idx.video >= 0 ? (r[idx.video] || '') : '';
          const embed = toEmbedUrl(videoUrl);

          if (artworkType === 'image' && !name) return null;
          if (artworkType === 'video' && !embed) return null;

          const featuredVal = idx.featured >= 0 ? (r[idx.featured] || '') : '';
          const isFeatured = featuredVal.toLowerCase().trim() === 'yes';

          const title  = idx.title  >= 0 ? (r[idx.title]  || '') : '';
          const artist = idx.artist >= 0 ? (r[idx.artist] || '') : '';
          const link   = idx.link   >= 0 ? (r[idx.link]   || '') : '';
          const src = name ? `${ARTWORK_DIR}/${encodeURIComponent(name).replace(/%2F/gi, '/')}` : '';

          return { title, artist, link, name, src, artworkType, videoUrl, embedUrl: embed, isFeatured };
        })
        .filter(Boolean)
        .filter(it => it.artworkType === 'video' || hasImageExt(it.name));

      return list;
    } catch (e) {
      console.error('[gallery] Sheet load/parse error:', e);
      return [];
    }
  }

  // ── Filtering
  function applyFilter() {
    const val = (typeFilter?.value || 'all').toLowerCase();
    if (val === 'image') view = items.filter(it => it.artworkType === 'image');
    else if (val === 'video') view = items.filter(it => it.artworkType === 'video');
    else if (val === 'featured') view = items.filter(it => it.isFeatured);
    else view = items.slice();
    currentCount = PAGE_SIZE; // reset batching whenever filter changes
  }

  function updateCounts() {
    const totalAll = items.length;
    const totalImg = items.filter(it => it.artworkType === 'image').length;
    const totalVid = items.filter(it => it.artworkType === 'video').length;
    if (totalAllEl) totalAllEl.textContent = String(totalAll);
    if (totalImagesEl) totalImagesEl.textContent = String(totalImg);
    if (totalVideosEl) totalVideosEl.textContent = String(totalVid);
  }

  function getVisibleSlice() {
    return view.slice(0, Math.min(currentCount, view.length));
  }

  // ── Render only visible items; manage Load More button
  function render() {
    galleryEl.textContent = '';

    const visible = getVisibleSlice();

    if (!visible.length) {
      galleryEl.innerHTML = `<p style="color:#9ca3af">No items match this filter.</p>`;
      if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.style.display = 'none';
      }
      updateCounts();
      return;
    }

    const frag = document.createDocumentFragment();

    visible.forEach((it, i) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('img');
      const cap = node.querySelector('.caption');

      img.src = it.src;
      img.alt = it.title || it.name || (it.artworkType === 'video' ? 'Video' : 'Artwork');

      const title = escapeHtml(it.title || it.name || '');
      const artist = it.artist ? ` <span class="artist">| ${escapeHtml(it.artist)}</span>` : '';
      const link = it.link
        ? ` <span class="ext"><a href="${it.link}" target="_blank" rel="noopener" aria-label="External link"><svg aria-hidden="true"><use href="#icon-link"></use></svg></a></span>`
        : '';
      const typeBadge = ` <span class="badge">${it.artworkType === 'video' ? 'Video' : 'Image'}</span>`;
      cap.innerHTML = `<span class="title">${title}</span>${artist}${link}${typeBadge}`;

      if (captionsToggle?.checked) node.classList.add('show-caption');

      if (it.artworkType === 'video') {
        node.classList.add('is-video');
        const corner = document.createElement('span');
        corner.className = 'corner-icon video-icon';
        corner.innerHTML = '<svg aria-hidden="true"><use href="#icon-play"></use></svg><span class="sr-only">Video</span>';
        node.appendChild(corner);
      }
      if (it.isFeatured) {
        node.classList.add('is-featured');
        const star = document.createElement('span');
        star.className = 'corner-icon star-icon';
        star.style.top = it.artworkType === 'video' ? '36px' : '8px';
        star.innerHTML = '<svg aria-hidden="true"><use href="#icon-star"></use></svg><span class="sr-only">Featured</span>';
        node.appendChild(star);
      }

      // open lightbox using the index within *visible* slice
      node.addEventListener('click', () => openLightbox(i));
      frag.appendChild(node);
    });

    galleryEl.appendChild(frag);

    // Load More visibility
    const hasMore = currentCount < view.length;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = !hasMore;
      loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    }

    updateCounts();
  }

// ── Lightbox functions (navigate within *visible* slice)
function openLightbox(iVisible) {
  const visible = getVisibleSlice();
  const it = visible[iVisible];
  if (!it) return;
  currentIndex = iVisible;

  if (it.artworkType === 'image') {
    ensureLbFrame(null);
    lbImg.style.display = '';
    lbImg.src = it.src;
  } else {
    lbImg.style.display = 'none';
    lbImg.src = '';
    ensureLbFrame(it.embedUrl);
  }

  // Build caption in this order: Artist | Title | Link
const artist = it.artist && it.artist.trim() ? escapeHtml(it.artist) : '';
const title  = escapeHtml(it.title || it.name || '');

const rawUrl   = String(it.link || '').trim();
const safeUrl  = escapeHtml(rawUrl);                  // for text/title
const hrefAttr = rawUrl.replace(/"/g, '&quot;');      // for href attribute

const linkHtml = rawUrl
  ? '<a class="lb-link" href="' + hrefAttr + '" target="_blank" rel="noopener noreferrer" title="' + safeUrl + '" aria-label="Open external link">' +
      '<svg class="lb-link-icon" aria-hidden="true"><use href="#icon-link"></use></svg>' +
      '<span class="lb-link-text">' + safeUrl + '</span>' +
    '</a>'
  : '';

const parts = [];
if (artist) parts.push(artist);
if (title)  parts.push(title);
if (linkHtml) parts.push(linkHtml);

lbCaption.innerHTML = parts.join(' | ');



  lb.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}


  function closeLightbox() {
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    lbImg.src = '';
    ensureLbFrame(null);
  }

  function showNext(delta) {
    const visible = getVisibleSlice();
    if (currentIndex < 0 || !visible.length) return;
    currentIndex = (currentIndex + delta + visible.length) % visible.length;
    openLightbox(currentIndex);
  }

  // ── Events
  lbClose?.addEventListener('click', closeLightbox);
  lb?.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  window.addEventListener('keydown', (e) => {
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext(1);
    if (e.key === 'ArrowLeft') showNext(-1);
  });
  lbPrev?.addEventListener('click', () => showNext(-1));
  lbNext?.addEventListener('click', () => showNext(1));

  captionsToggle?.addEventListener('change', () => {
    document.querySelectorAll('.thumb').forEach(el =>
      el.classList.toggle('show-caption', captionsToggle.checked)
    );
  });

  typeFilter?.addEventListener('change', () => { applyFilter(); render(); });

  shuffleBtn?.addEventListener('click', () => {
    for (let i = view.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [view[i], view[j]] = [view[j], view[i]];
    }
    currentCount = PAGE_SIZE; // reset to first page after shuffle
    render();
  });

  loadMoreBtn?.addEventListener('click', () => {
    currentCount = Math.min(currentCount + PAGE_SIZE, view.length);
    render();
  });

  // ── Init
  (async function init() {
    galleryEl.setAttribute('aria-busy', 'true');
    items = await loadFromSheet();
    applyFilter();
    galleryEl.setAttribute('aria-busy', 'false');
    render();
  })();
})();
