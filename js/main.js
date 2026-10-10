const CATALOG_URL = 'data/catalog.json';
const TAXONOMY_URL = 'data/taxonomy.json';
const TELEGRAM_USERNAME = 'ppolinom';

// YouTube: получите API ключ на https://console.cloud.google.com → YouTube Data API v3
// Ограничьте ключ по HTTP referrer: ppolinom.ru/* (чтобы не было злоупотреблений)
const YOUTUBE_API_KEY = '';
const YOUTUBE_CHANNEL_HANDLE = 'ppolinom';
const YOUTUBE_CHANNEL_URL = `https://www.youtube.com/@${YOUTUBE_CHANNEL_HANDLE}`;

async function loadCatalog() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error('catalog not found');
  return res.json();
}

async function loadTaxonomy() {
  try {
    const res = await fetch(TAXONOMY_URL);
    if (!res.ok) return { sections: [], categories: [], collections: [] };
    return res.json();
  } catch {
    return { sections: [], categories: [], collections: [] };
  }
}

function imgSrc(productId, filename) {
  return `products/${productId}/images/${filename}`;
}

// ── YouTube ────────────────────────────────────────────────────────────────────

async function fetchYouTubeLatestVideo() {
  if (!YOUTUBE_API_KEY) return null;
  try {
    // Шаг 1: получаем ID плейлиста загрузок канала
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${YOUTUBE_CHANNEL_HANDLE}&key=${YOUTUBE_API_KEY}`
    );
    if (!chRes.ok) return null;
    const chData = await chRes.json();
    const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return null;

    // Шаг 2: первый элемент плейлиста = последнее видео
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=${uploadsId}&key=${YOUTUBE_API_KEY}`
    );
    if (!plRes.ok) return null;
    const plData = await plRes.json();
    const snippet = plData.items?.[0]?.snippet;
    if (!snippet) return null;

    const videoId = snippet.resourceId?.videoId;
    if (!videoId) return null;
    const thumb = snippet.thumbnails?.maxres?.url
      || snippet.thumbnails?.standard?.url
      || snippet.thumbnails?.high?.url
      || null;
    return { videoId, thumb, url: `https://www.youtube.com/watch?v=${videoId}` };
  } catch {
    return null;
  }
}

// ── Index page ────────────────────────────────────────────────────────────────

async function initIndex() {
  const grid = document.getElementById('grid');
  const heroSection = document.getElementById('collections-section');

  let catalog, taxonomy;
  try {
    [catalog, taxonomy] = await Promise.all([loadCatalog(), loadTaxonomy()]);
  } catch {
    grid.innerHTML = '<p class="error">Не удалось загрузить каталог.</p>';
    return;
  }

  catalog = catalog.filter(p => p.visible !== false);

  function getProductSections(p) { return Array.isArray(p.sections) ? p.sections : []; }
  function getProductCollections(p) { return Array.isArray(p.collections) ? p.collections : []; }
  function getProductCategories(p) {
    if (Array.isArray(p.categories)) return p.categories;
    if (p.category) return [p.category];
    return [];
  }
  function getCardLabel(p) {
    const s = getProductSections(p);
    if (s.length) return s.join(', ');
    const c = getProductCategories(p);
    if (c.length) return c.join(', ');
    return '';
  }

  let activeSection = '';
  let activeCollection = '';
  let activeCategory = '';

  function applyFilters() {
    const filtered = catalog.filter(p => {
      if (activeSection && !getProductSections(p).some(s => s.toLowerCase() === activeSection.toLowerCase())) return false;
      if (activeCollection && !getProductCollections(p).some(c => c.toLowerCase() === activeCollection.toLowerCase())) return false;
      if (activeCategory && !getProductCategories(p).some(c => c.toLowerCase() === activeCategory.toLowerCase())) return false;
      return true;
    });
    renderGrid(filtered);
  }

  function setFilter(type, value) {
    if (type === 'section') activeSection = value;
    else if (type === 'collection') activeCollection = value;
    else if (type === 'category') activeCategory = value;
    document.querySelectorAll(`[data-filter-type="${type}"]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filterVal === value);
    });
    if (type === 'collection') {
      document.querySelectorAll('.hero-slide[data-col]').forEach(el => {
        el.classList.toggle('active', value !== '' && el.dataset.col === value);
      });
    }
    applyFilters();
  }

  // ── Hero carousel ──────────────────────────────────────────────────────────

  // Новинка: последний видимый товар (по createdAt, иначе по порядку в каталоге)
  const newestProduct = catalog.length
    ? catalog.reduce((best, p) => {
        if (p.createdAt && best.createdAt) return p.createdAt > best.createdAt ? p : best;
        if (p.createdAt) return p;
        if (best.createdAt) return best;
        return p; // без меток времени — побеждает последний в каталоге
      })
    : null;

  // YouTube (не блокирует отрисовку — всё равно await, но быстро)
  const ytData = await fetchYouTubeLatestVideo().catch(() => null);

  const enabledCollections = (taxonomy.collections || []).filter(c => c.enabled);

  // Собираем слайды
  const heroSlides = [];

  if (newestProduct) {
    heroSlides.push({
      type: 'new',
      title: newestProduct.name,
      badge: 'Новинка',
      bgImage: newestProduct.images?.[0] ? imgSrc(newestProduct.id, newestProduct.images[0]) : null,
      href: `product.html?id=${newestProduct.id}`,
      target: '_self'
    });
  }

  heroSlides.push({
    type: 'youtube',
    title: 'Мой YouTube канал',
    badge: ytData ? 'Последнее видео' : null,
    bgImage: ytData?.thumb || null,
    href: ytData?.url || YOUTUBE_CHANNEL_URL,
    target: '_blank',
    ytFallback: !ytData?.thumb
  });

  enabledCollections.forEach(c => {
    heroSlides.push({
      type: 'collection',
      title: c.name,
      badge: 'Подборка',
      bgImage: c.image || null,
      collectionName: c.name
    });
  });

  if (heroSlides.length > 0 && heroSection) {
    heroSection.classList.remove('hidden');
    renderHeroCarousel(heroSlides, heroSection, collectionName => {
      const newVal = activeCollection === collectionName ? '' : collectionName;
      setFilter('collection', newVal);
      grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ── Filter rows ───────────────────────────────────────────────────────────
  const allSections = [...new Set([...(taxonomy.sections || []), ...catalog.flatMap(getProductSections)])];
  const allCollectionNames = [...new Set([
    ...(taxonomy.collections || []).filter(c => c.enabled).map(c => c.name),
    ...catalog.flatMap(getProductCollections)
  ])];
  const allCategories = [...new Set([...(taxonomy.categories || []), ...catalog.flatMap(getProductCategories)])];

  function buildFilterRow(elId, items, type, labelAll) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items.length) { el.classList.add('hidden'); return; }
    el.innerHTML = `<button class="filter-btn active" data-filter-type="${type}" data-filter-val="">${labelAll}</button>` +
      items.map(v => `<button class="filter-btn" data-filter-type="${type}" data-filter-val="${v}">${v}</button>`).join('');
    el.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      setFilter(type, btn.dataset.filterVal);
    });
  }

  buildFilterRow('filter-sections', allSections, 'section', 'Все разделы');
  buildFilterRow('filter-collections', allCollectionNames, 'collection', 'Все подборки');
  buildFilterRow('filter-categories', allCategories, 'category', 'Все категории');

  function renderGrid(items) {
    if (!items.length) {
      grid.innerHTML = '<p class="empty">Нет товаров.</p>';
      return;
    }
    grid.innerHTML = items.map(product => {
      const thumb = product.images?.[0]
        ? `<img class="card-img" src="${imgSrc(product.id, product.images[0])}" alt="${product.name}" loading="lazy">`
        : `<div class="card-img-placeholder">🧶</div>`;
      const avail = product.availability || (product.available === false ? 'unavailable' : 'available');
      const unavailable = avail === 'unavailable'
        ? '<span class="badge-unavailable">Нет в наличии</span>'
        : avail === 'on_order' ? '<span class="badge-unavailable">На заказ</span>' : '';
      const label = getCardLabel(product);
      return `
        <a class="card" href="product.html?id=${product.id}">
          ${thumb}
          <div class="card-body">
            ${label ? `<div class="card-category">${label}</div>` : ''}
            <div class="card-name">${product.name}</div>
            ${unavailable}
            <div class="card-price">${product.price} ₽</div>
          </div>
        </a>
      `;
    }).join('');
  }

  applyFilters();
}

// ── Hero carousel ──────────────────────────────────────────────────────────────

const YT_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="#FF0000" d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805z"/>
  <path fill="#fff" d="M9.609 15.601V8.408l6.264 3.602z"/>
</svg>`;

function renderHeroCarousel(slides, container, onCollectionClick) {
  const N = slides.length;
  if (!N) return;

  function makeSlideHTML(s) {
    const bgStyle = s.bgImage ? `style="background-image:url('${s.bgImage}')"` : '';
    const href = s.href || '#';
    const targetAttr = s.target ? `target="${s.target}"` : '';
    const colAttr = s.type === 'collection' ? `data-col="${s.collectionName}"` : '';
    return `<a class="hero-slide" href="${href}" ${targetAttr} ${bgStyle} ${colAttr}>
      ${s.ytFallback ? `<div class="hero-yt-fallback">${YT_ICON_SVG}</div>` : ''}
      <div class="hero-slide-footer">
        ${s.badge ? `<span class="hero-slide-badge">${s.badge}</span>` : ''}
        <div class="hero-slide-title">${s.title}</div>
      </div>
    </a>`;
  }

  // Зацикливание через клонирование крайних слайдов
  const trackSlides = N > 1 ? [slides[N - 1], ...slides, slides[0]] : slides;
  let currentIdx = N > 1 ? 1 : 0;
  const autoRotate = N > 3;

  const dotsHTML = N > 1
    ? `<div class="hero-dots">${slides.map((_, i) => `<button data-i="${i}"${i === 0 ? ' class="active"' : ''}></button>`).join('')}</div>`
    : '';
  const navHTML = N > 1
    ? `<button class="hero-btn hero-prev" aria-label="Назад">‹</button>
       <button class="hero-btn hero-next" aria-label="Вперёд">›</button>`
    : '';

  container.innerHTML = `
    <div class="hero-carousel">
      <div class="hero-track" style="transform:translateX(${N > 1 ? '-100%' : '0'})">
        ${trackSlides.map(makeSlideHTML).join('')}
      </div>
      ${navHTML}
      ${dotsHTML}
    </div>
  `;

  const track = container.querySelector('.hero-track');
  const dots = [...container.querySelectorAll('.hero-dots button')];

  // Включаем анимацию после рендера (иначе начальный translateX тоже анимируется)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    track.style.transition = 'transform 0.5s ease';
  }));

  function realIdx(idx) {
    return N > 1 ? ((idx - 1 + N) % N) : 0;
  }

  function updateDots() {
    const ri = realIdx(currentIdx);
    dots.forEach((d, i) => d.classList.toggle('active', i === ri));
  }

  function goTo(idx) {
    currentIdx = idx;
    track.style.transform = `translateX(${-currentIdx * 100}%)`;
    updateDots();
  }

  if (N > 1) {
    track.addEventListener('transitionend', () => {
      if (currentIdx === 0) {
        // Перепрыгнули до клона последнего — мгновенно возвращаем на реальный
        track.style.transition = 'none';
        currentIdx = N;
        track.style.transform = `translateX(${-N * 100}%)`;
        track.getBoundingClientRect(); // force reflow
        track.style.transition = 'transform 0.5s ease';
        updateDots();
      } else if (currentIdx === N + 1) {
        // Перепрыгнули за клон первого — мгновенно на реальный
        track.style.transition = 'none';
        currentIdx = 1;
        track.style.transform = 'translateX(-100%)';
        track.getBoundingClientRect();
        track.style.transition = 'transform 0.5s ease';
        updateDots();
      }
    });
  }

  const advance = () => goTo(currentIdx + 1);
  const retreat = () => goTo(currentIdx - 1);

  let autoTimer = null;

  function startAuto() {
    if (!autoRotate) return;
    autoTimer = setInterval(advance, 10000);
  }

  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  container.querySelector('.hero-prev')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); retreat(); resetAuto();
  });
  container.querySelector('.hero-next')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); advance(); resetAuto();
  });

  dots.forEach((d, i) => {
    d.addEventListener('click', e => {
      e.stopPropagation(); goTo(i + 1); resetAuto();
    });
  });

  // Клик на слайд-подборку → фильтр
  container.querySelectorAll('.hero-slide[data-col]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      onCollectionClick(el.dataset.col);
    });
  });

  startAuto();
}

// ── Product page ──────────────────────────────────────────────────────────────

async function initProduct() {
  const container = document.getElementById('product-container');
  const id = new URLSearchParams(location.search).get('id');

  if (!id) { container.innerHTML = '<p class="error">Товар не указан.</p>'; return; }

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    container.innerHTML = '<p class="error">Не удалось загрузить каталог.</p>';
    return;
  }

  const product = catalog.find(p => p.id === id);
  if (!product) { container.innerHTML = '<p class="error">Товар не найден.</p>'; return; }

  document.title = `${product.name} — ppolinom handmade`;

  const tgText = encodeURIComponent(`Хочу заказать: ${product.name} — ${product.price} ₽\n${location.href}`);
  const tgLink = `https://t.me/${TELEGRAM_USERNAME}?text=${tgText}`;

  const isHidden = product.visible === false;
  const avail = product.availability || (product.available === false ? 'unavailable' : 'available');

  let orderBtn;
  if (isHidden) {
    orderBtn = `<div class="removed-notice">Этот товар снят с продажи</div>
      <button class="btn-order btn-order-disabled" disabled>Написать в Telegram</button>`;
  } else if (avail === 'unavailable') {
    orderBtn = `<span class="badge-unavailable" style="font-size:0.9rem;padding:0.5rem 1rem">Нет в наличии</span>`;
  } else {
    orderBtn = `<a class="btn-order" href="${tgLink}" target="_blank">${avail === 'on_order' ? 'Заказать в Telegram' : 'Написать в Telegram'}</a>`;
  }

  const cats = Array.isArray(product.sections) && product.sections.length ? product.sections
    : Array.isArray(product.categories) ? product.categories
    : product.category ? [product.category] : [];

  container.innerHTML = `
    <a class="back-link" href="./"><span>←</span> Все товары</a>
    <div class="product-layout">
      <div id="carousel"></div>
      <div class="product-info">
        <div class="category">${cats.join(', ')}</div>
        <h1>${product.name}</h1>
        <div class="price">${product.price} ₽</div>
        <div class="description">${product.description || ''}</div>
        ${orderBtn}
      </div>
    </div>
  `;

  renderCarousel(product);
}

function renderCarousel(product) {
  const el = document.getElementById('carousel');
  if (!product.images?.length) {
    el.innerHTML = '<div class="card-img-placeholder" style="aspect-ratio:1;border-radius:12px">🧶</div>';
    return;
  }

  let current = 0;

  function update() {
    track.style.transform = `translateX(-${current * 100}%)`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === product.images.length - 1;
    dots.querySelectorAll('button').forEach((d, i) => d.classList.toggle('active', i === current));
  }

  el.innerHTML = `
    <div class="carousel">
      <div class="carousel-track">
        ${product.images.map(img => `<img src="${imgSrc(product.id, img)}" alt="${product.name}">`).join('')}
      </div>
      ${product.images.length > 1 ? `
        <button class="carousel-btn prev" aria-label="Назад">‹</button>
        <button class="carousel-btn next" aria-label="Вперёд">›</button>
        <div class="carousel-dots">
          ${product.images.map((_, i) => `<button aria-label="${i+1}"></button>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  const track = el.querySelector('.carousel-track');
  const prevBtn = el.querySelector('.carousel-btn.prev');
  const nextBtn = el.querySelector('.carousel-btn.next');
  const dots = el.querySelector('.carousel-dots');

  if (prevBtn) prevBtn.addEventListener('click', () => { current--; update(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { current++; update(); });
  if (dots) dots.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    current = [...dots.querySelectorAll('button')].indexOf(btn);
    update();
  });

  if (product.images.length > 1) update();
}

// ── Twitch status ─────────────────────────────────────────────────────────────

const TWITCH_LOGIN = 'ppolinom';
const TWITCH_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657l6.269-6.269V0H2.149zm19.164 13.612l-3.582 3.582H12.87l-3.045 3.045v-3.045H4.537V2.149h16.776v11.463zm-3.582-7.343v6.262h-2.149V6.269h2.149zm-5.731 0v6.262H9.851V6.269H12z"/></svg>`;

async function initTwitchStatus() {
  const el = document.getElementById('twitch-status');
  if (!el) return;
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json' },
      body: JSON.stringify([{ query: `{ user(login: "${TWITCH_LOGIN}") { stream { id } } }` }])
    });
    const data = await res.json();
    const isLive = !!data[0]?.data?.user?.stream;
    if (isLive) {
      el.classList.add('is-live');
      el.innerHTML = `<span class="twitch-dot"></span>${TWITCH_ICON}Мастер онлайн`;
    } else {
      el.innerHTML = `${TWITCH_ICON}Канал Twitch`;
    }
  } catch {
    el.innerHTML = `${TWITCH_ICON}Канал Twitch`;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

if (document.getElementById('grid')) initIndex();
if (document.getElementById('product-container')) initProduct();
initTwitchStatus();
