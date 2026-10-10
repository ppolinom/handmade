const CATALOG_URL = '/data/catalog.json';
const TELEGRAM_USERNAME = 'ppolinom'; // поменяй на свой username в Telegram

async function loadCatalog() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error('catalog not found');
  return res.json();
}

function imgSrc(productId, filename) {
  return `/products/${productId}/images/${filename}`;
}

// ── Index page ────────────────────────────────────────────────────────────────

async function initIndex() {
  const grid = document.getElementById('grid');
  const categoriesEl = document.getElementById('categories');

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    grid.innerHTML = '<p class="error">Не удалось загрузить каталог.</p>';
    return;
  }

  const categories = ['Все', ...new Set(catalog.map(p => p.category).filter(Boolean))];
  let activeCategory = 'Все';

  categoriesEl.innerHTML = categories.map(cat => `
    <button class="category-btn${cat === activeCategory ? ' active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

  categoriesEl.addEventListener('click', e => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    categoriesEl.querySelectorAll('.category-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeCategory));
    renderGrid();
  });

  function renderGrid() {
    const filtered = activeCategory === 'Все'
      ? catalog
      : catalog.filter(p => p.category === activeCategory);

    if (filtered.length === 0) {
      grid.innerHTML = '<p class="empty">Нет товаров в этой категории.</p>';
      return;
    }

    grid.innerHTML = filtered.map(product => {
      const thumb = product.images?.[0]
        ? `<img class="card-img" src="${imgSrc(product.id, product.images[0])}" alt="${product.name}" loading="lazy">`
        : `<div class="card-img-placeholder">🧶</div>`;

      const unavailable = product.available === false
        ? '<span class="badge-unavailable">Нет в наличии</span>'
        : '';

      return `
        <a class="card" href="/product.html?id=${product.id}">
          ${thumb}
          <div class="card-body">
            <div class="card-category">${product.category || ''}</div>
            <div class="card-name">${product.name}</div>
            ${unavailable}
            <div class="card-price">${product.price} ₽</div>
          </div>
        </a>
      `;
    }).join('');
  }

  renderGrid();
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

  const pageUrl = encodeURIComponent(location.href);
  const tgText = encodeURIComponent(`Хочу заказать: ${product.name} — ${product.price} ₽\n${location.href}`);
  const tgLink = `https://t.me/${TELEGRAM_USERNAME}?text=${tgText}`;

  const orderBtn = product.available !== false
    ? `<a class="btn-order" href="${tgLink}" target="_blank">Написать в Telegram</a>`
    : `<span class="badge-unavailable" style="font-size:0.9rem;padding:0.5rem 1rem">Нет в наличии</span>`;

  container.innerHTML = `
    <a class="back-link" href="/"><span>←</span> Все товары</a>
    <div class="product-layout">
      <div id="carousel"></div>
      <div class="product-info">
        <div class="category">${product.category || ''}</div>
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

// ── Boot ──────────────────────────────────────────────────────────────────────

if (document.getElementById('grid')) initIndex();
if (document.getElementById('product-container')) initProduct();
