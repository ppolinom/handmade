const CATALOG_URL = 'data/catalog.json';
const TAXONOMY_URL = 'data/taxonomy.json';
const TELEGRAM_USERNAME = 'ppolinom';

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

// ── Index page ────────────────────────────────────────────────────────────────

async function initIndex() {
  const grid = document.getElementById('grid');
  const collectionsSection = document.getElementById('collections-section');

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
      document.querySelectorAll('.collection-card').forEach(c => {
        c.classList.toggle('active', value !== '' && c.dataset.name === value);
      });
    }
    applyFilters();
  }

  // ── Collections carousel ──────────────────────────────────────────────
  const enabledCollections = (taxonomy.collections || []).filter(c => c.enabled);
  if (enabledCollections.length > 0 && collectionsSection) {
    collectionsSection.classList.remove('hidden');
    renderCollectionsCarousel(enabledCollections, collectionsSection, name => {
      const newVal = activeCollection === name ? '' : name;
      setFilter('collection', newVal);
      grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ── Filter rows ───────────────────────────────────────────────────────
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

// ── Collections carousel ──────────────────────────────────────────────────────

function renderCollectionsCarousel(collections, container, onSelect) {
  container.innerHTML = `
    <div class="collections-carousel">
      <div class="collections-track">
        ${collections.map(c => `
          <button class="collection-card" data-name="${c.name}">
            ${c.image ? `<img src="${c.image}" alt="${c.name}" class="collection-img">` : '<div class="collection-img-empty"></div>'}
            <div class="collection-name">${c.name}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.collection-card').forEach(card => {
    card.addEventListener('click', () => onSelect(card.dataset.name));
  });

  if (collections.length >= 3) {
    const track = container.querySelector('.collections-track');
    let idx = 0;
    setInterval(() => {
      idx++;
      const card = track.querySelector('.collection-card');
      if (!card) return;
      const style = getComputedStyle(track);
      const gap = parseFloat(style.gap) || 16;
      const cardW = card.getBoundingClientRect().width + gap;

      if (idx >= collections.length) {
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        track.getBoundingClientRect(); // force reflow
        track.style.transition = 'transform 0.5s ease';
        idx = 0;
      } else {
        track.style.transform = `translateX(-${idx * cardW}px)`;
      }
    }, 3000);
  }
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
