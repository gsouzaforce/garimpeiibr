const PER_PAGE = 20;

let allProducts = [], filteredProducts = [];
let page = 1;
let activeNiche = 'todos', activePlatform = 'todos', activeCats = [], activeOrigins = [];
let activeSort  = 'recentes', activeDiscount = 'todos', searchQuery = '';
let priceRangeMin = 0, priceRangeMax = 0, priceFilterMin = 0, priceFilterMax = 0;
let searchTimer;

const DISCOUNT_OPTIONS = [
  { v: 'todos', label: 'Qualquer desconto' },
  { v: '20',   label: 'Acima de 20% OFF'  },
  { v: '50',   label: 'Acima de 50% OFF'  },
];

// ── LOAD ─────────────────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    const raw = await fetchProducts();
    allProducts = raw.map(p => ({
      ...p,
      _platform: detectPlatform(p.affiliate_link),
      _niche:    detectNiche(p.niche_id),
      _origin:   detectOrigin(p),
    }));
    buildFilters();
    applyFilters();
  } catch (e) {
    document.getElementById('grid').innerHTML = `
      <div class="estado">
        <span class="estado-ico">⚠️</span>
        <p>Não foi possível carregar os produtos.</p>
        <small>${e.message} — verifique se o webhook do n8n está ativo.</small>
      </div>`;
  }
}

// ── BUILD SIDEBAR ─────────────────────────────────────────────────────────────
function buildFilters() {
  const nichoCounts = {}, platCounts = {}, catCounts = {}, originCounts = {};
  allProducts.forEach(p => {
    nichoCounts[p._niche]   = (nichoCounts[p._niche]   || 0) + 1;
    platCounts[p._platform] = (platCounts[p._platform] || 0) + 1;
    if (p.category) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    if (p._origin)  originCounts[p._origin] = (originCounts[p._origin] || 0) + 1;
  });

  // Nicho
  const niches = ['todos', ...new Set(allProducts.map(p => p._niche).sort())];
  document.getElementById('nichoFilters').innerHTML = niches.map(v => `
    <div class="sidebar-item ${activeNiche === v ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setNiche('${esc(v)}')">
      ${v !== 'todos' ? nicheLogo(v) : ''}
      <span class="sidebar-label">${v === 'todos' ? 'Todos' : nicheDisplayName(v)}</span>
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (nichoCounts[v] || 0)}</span>
    </div>`).join('');

  // Plataforma
  const plats = ['todos', ...new Set(allProducts.map(p => p._platform).sort())];
  document.getElementById('platFilters').innerHTML = plats.map(v => `
    <div class="sidebar-item ${activePlatform === v ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setPlatform('${esc(v)}')">
      ${v !== 'todos' ? platformLogo(v) : ''}
      ${v === 'todos' ? '<span class="sidebar-label">Todas</span>' : ''}
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (platCounts[v] || 0)}</span>
    </div>`).join('');

  // Categoria (multi-select)
  const cats = ['todos', ...new Set(allProducts.map(p => p.category).filter(Boolean).sort())];
  document.getElementById('catFilters').innerHTML = cats.map(v => {
    const isActive = v === 'todos' ? activeCats.length === 0 : activeCats.includes(v);
    return `<div class="sidebar-item ${isActive ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setCat('${esc(v)}')">
      <span class="sidebar-label">${v === 'todos' ? 'Todas' : esc(v)}</span>
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (catCounts[v] || 0)}</span>
    </div>`;
  }).join('');

  // Desconto (single-select)
  document.getElementById('discountFilters').innerHTML = DISCOUNT_OPTIONS.map(({ v, label }) => `
    <div class="sidebar-item ${activeDiscount === v ? 'ativo' : ''}" data-value="${v}" onclick="setDiscount('${v}')">
      <span class="sidebar-label">${label}</span>
    </div>`).join('');

  // Preço
  const prices = allProducts.map(p => p.price).filter(v => v > 0);
  if (prices.length) {
    priceRangeMin = Math.floor(Math.min(...prices));
    priceRangeMax = Math.ceil(Math.max(...prices));
    priceFilterMin = priceRangeMin;
    priceFilterMax = priceRangeMax;
    const step = Math.max(1, Math.round((priceRangeMax - priceRangeMin) / 100));
    document.getElementById('priceRangeWrap').innerHTML = `
      <div class="price-labels">
        <span id="priceValMin">${fmtBRL(priceFilterMin)}</span>
        <span id="priceValMax">${fmtBRL(priceFilterMax)}</span>
      </div>
      <div class="price-slider-wrap">
        <div class="price-track">
          <div class="price-fill" id="priceFill" style="left:0%;right:0%"></div>
        </div>
        <input type="range" class="price-range" id="priceMin"
               min="${priceRangeMin}" max="${priceRangeMax}" step="${step}"
               value="${priceFilterMin}" oninput="onPriceMin(this.value)">
        <input type="range" class="price-range" id="priceMax"
               min="${priceRangeMin}" max="${priceRangeMax}" step="${step}"
               value="${priceFilterMax}" oninput="onPriceMax(this.value)">
      </div>`;
  }

  updateActiveFilterCount();
}

// ── SETTERS ───────────────────────────────────────────────────────────────────
function setNiche(v) {
  activeNiche = v;
  document.querySelectorAll('#nichoFilters .sidebar-item').forEach(el =>
    el.classList.toggle('ativo', el.dataset.value === v)
  );
  page = 1; updateActiveFilterCount(); applyFilters();
}

function setPlatform(v) {
  activePlatform = v;
  document.querySelectorAll('#platFilters .sidebar-item').forEach(el =>
    el.classList.toggle('ativo', el.dataset.value === v)
  );
  page = 1; updateActiveFilterCount(); applyFilters();
}

function setCat(v) {
  if (v === 'todos') {
    activeCats = [];
  } else {
    const idx = activeCats.indexOf(v);
    if (idx === -1) activeCats.push(v);
    else activeCats.splice(idx, 1);
  }
  document.querySelectorAll('#catFilters .sidebar-item').forEach(el => {
    const val = el.dataset.value;
    el.classList.toggle('ativo', val === 'todos' ? activeCats.length === 0 : activeCats.includes(val));
  });
  page = 1; updateActiveFilterCount(); applyFilters();
}

function removeCat(v) {
  activeCats = activeCats.filter(c => c !== v);
  document.querySelectorAll('#catFilters .sidebar-item').forEach(el => {
    const val = el.dataset.value;
    el.classList.toggle('ativo', val === 'todos' ? activeCats.length === 0 : activeCats.includes(val));
  });
  page = 1; updateActiveFilterCount(); applyFilters();
}

function setDiscount(v) {
  activeDiscount = v;
  document.querySelectorAll('#discountFilters .sidebar-item').forEach(el =>
    el.classList.toggle('ativo', el.dataset.value === v)
  );
  page = 1; updateActiveFilterCount(); applyFilters();
}

function setSort(v) {
  activeSort = v;
  const sel = document.getElementById('sortSelect');
  if (sel) sel.value = v;
  page = 1; applyFilters();
}

function setSearch(q) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = normalize(q.trim());
    page = 1;
    applyFilters();
  }, 200);
}

function resetFilters() {
  activeNiche = 'todos'; activePlatform = 'todos';
  activeCats = []; activeOrigins = [];
  activeSort = 'recentes'; activeDiscount = 'todos'; searchQuery = '';
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  const sel = document.getElementById('sortSelect');
  if (sel) sel.value = 'recentes';
  page = 1;
  buildFilters();
  applyFilters();
}

function clearSearch() {
  searchQuery = '';
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  page = 1;
  applyFilters();
}

// ── PRICE RANGE ───────────────────────────────────────────────────────────────
function onPriceMin(v) {
  priceFilterMin = Math.min(parseInt(v), priceFilterMax - 1);
  document.getElementById('priceMin').value = priceFilterMin;
  updatePriceFill();
  document.getElementById('priceValMin').textContent = fmtBRL(priceFilterMin);
  page = 1; updateActiveFilterCount(); applyFilters();
}

function onPriceMax(v) {
  priceFilterMax = Math.max(parseInt(v), priceFilterMin + 1);
  document.getElementById('priceMax').value = priceFilterMax;
  updatePriceFill();
  document.getElementById('priceValMax').textContent = fmtBRL(priceFilterMax);
  page = 1; updateActiveFilterCount(); applyFilters();
}

function updatePriceFill() {
  const fill = document.getElementById('priceFill');
  if (!fill || priceRangeMax === priceRangeMin) return;
  const range = priceRangeMax - priceRangeMin;
  const pct1 = ((priceFilterMin - priceRangeMin) / range) * 100;
  const pct2 = ((priceFilterMax - priceRangeMin) / range) * 100;
  fill.style.left  = pct1 + '%';
  fill.style.right = (100 - pct2) + '%';
}

function resetPriceFilter() {
  priceFilterMin = priceRangeMin;
  priceFilterMax = priceRangeMax;
  const minEl = document.getElementById('priceMin');
  const maxEl = document.getElementById('priceMax');
  if (minEl) minEl.value = priceFilterMin;
  if (maxEl) maxEl.value = priceFilterMax;
  updatePriceFill();
  const vMin = document.getElementById('priceValMin');
  const vMax = document.getElementById('priceValMax');
  if (vMin) vMin.textContent = fmtBRL(priceFilterMin);
  if (vMax) vMax.textContent = fmtBRL(priceFilterMax);
  page = 1; updateActiveFilterCount(); applyFilters();
}

function updateActiveFilterCount() {
  let count = 0;
  if (activeNiche    !== 'todos') count++;
  if (activePlatform !== 'todos') count++;
  if (activeCats.length    > 0)   count++;
  if (activeOrigins.length > 0)   count++;
  if (activeDiscount !== 'todos') count++;
  if (searchQuery) count++;
  if (priceFilterMin > priceRangeMin || priceFilterMax < priceRangeMax) count++;
  const badge = document.getElementById('activeFilterCount');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

// ── SORT ─────────────────────────────────────────────────────────────────────
function sortProducts(list) {
  const s = [...list];
  switch (activeSort) {
    case 'desconto-maior': return s.sort((a, b) => (b.discount    || 0) - (a.discount    || 0));
    case 'preco-menor':    return s.sort((a, b) => (a.price       || 0) - (b.price       || 0));
    case 'preco-maior':    return s.sort((a, b) => (b.price       || 0) - (a.price       || 0));
    case 'avaliacao':      return s.sort((a, b) => (b.rating_star || 0) - (a.rating_star || 0));
    default:               return s;
  }
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function applyFilters() {
  const q = searchQuery;
  const priceActive = priceFilterMin > priceRangeMin || priceFilterMax < priceRangeMax;
  filteredProducts = allProducts.filter(p => {
    if (activeNiche    !== 'todos' && p._niche    !== activeNiche)         return false;
    if (activePlatform !== 'todos' && p._platform !== activePlatform)      return false;
    if (activeCats.length    > 0   && !activeCats.includes(p.category))   return false;
    if (activeOrigins.length > 0   && !activeOrigins.includes(p._origin)) return false;
    if (activeDiscount !== 'todos') {
      const min = parseInt(activeDiscount);
      if (!p.discount || p.discount < min) return false;
    }
    if (priceActive && p.price > 0 && (p.price < priceFilterMin || p.price > priceFilterMax)) return false;
    if (q && !(
      normalize(p.product_name || '').includes(q) ||
      normalize(p.category     || '').includes(q)
    )) return false;
    return true;
  });
  filteredProducts = sortProducts(filteredProducts);
  renderActiveFilters();
  renderGrid(); renderPagination(); renderCount();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderCount() {
  const el    = document.getElementById('toolbarCount');
  const total = filteredProducts.length;
  if (!total) { el.innerHTML = ''; return; }
  const s = (page - 1) * PER_PAGE + 1;
  const e = Math.min(page * PER_PAGE, total);
  el.innerHTML = `Mostrando <b>${s}–${e}</b> de <b>${total}</b> oferta${total !== 1 ? 's' : ''}`;
}

function renderGrid() {
  const grid  = document.getElementById('grid');
  const slice = filteredProducts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (!filteredProducts.length) {
    grid.innerHTML = `<div class="estado"><span class="estado-ico">🔍</span><p>Nenhuma oferta encontrada para esse filtro.</p></div>`;
    return;
  }

  grid.innerHTML = slice.map(p => {
    const sc       = storeClass(p._platform);
    const hasDisc  = p.discount > 0;
    const hasPrice = p.price > 0;
    const saving   = hasDisc && p.list_price > 0 ? fmtBRL(p.list_price - p.price) : null;
    const rev      = fmtNum(p.reviews);
    const dateStr  = fmtDate(p);
    const logo     = platformLogo(p._platform);
    const origin   = p._origin;

    const originPill = origin
      ? `<span class="origin-pill origin-${origin}">${originIcon(origin, 10)}<span>${ORIGIN_NAMES[origin]}</span></span>`
      : '';
    const datePill = dateStr
      ? `<span class="card-date"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Postado ${dateStr}</span>`
      : '';

    return `<div class="card">
      <div class="card-img">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="${esc(p.product_name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <span class="card-img-placeholder" style="${p.image_url ? 'display:none' : 'display:flex'}">📦</span>
        ${hasDisc ? `<span class="discount-badge">-${Math.round(p.discount)}%</span>` : ''}
        <span class="store-badge store-${sc}">${logo}</span>
      </div>
      <div class="card-body">
        ${p.category ? `<div class="card-cat">${esc(p.category)}</div>` : ''}
        <p class="card-name">${esc(p.product_name)}</p>
        ${p.rating_star > 0 ? `<div class="card-rating"><span class="rating-stars">★ ${p.rating_star}</span>${rev ? `<span>${rev} aval.</span>` : ''}</div>` : ''}
        <div class="card-price">
          ${hasPrice ? `<div class="price-current">${fmtBRL(p.price)}</div>` : ''}
          ${hasDisc && p.list_price > 0 ? `<div class="price-original">de ${fmtBRL(p.list_price)}</div>` : ''}
          ${saving ? `<div class="price-saving">Economia de ${saving}</div>` : ''}
        </div>
        <a href="${esc(p.affiliate_link)}" target="_blank" rel="noopener sponsored" class="btn-deal">
          Ver oferta
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        ${(originPill || datePill) ? `<div class="card-footer">${originPill}${datePill}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── PAGINATION ────────────────────────────────────────────────────────────────
function renderPagination() {
  const total = Math.ceil(filteredProducts.length / PER_PAGE);
  const el    = document.getElementById('paginacao');
  if (total <= 1) { el.innerHTML = ''; return; }

  let h = `<button class="pag-btn" onclick="goPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>←</button>`;
  pagRange(page, total).forEach(p => {
    h += p === '...'
      ? `<span class="pag-dots">…</span>`
      : `<button class="pag-btn${p === page ? ' ativo' : ''}" onclick="goPage(${p})">${p}</button>`;
  });
  h += `<button class="pag-btn" onclick="goPage(${page + 1})" ${page === total ? 'disabled' : ''}>→</button>`;
  el.innerHTML = h;
}

function pagRange(cur, tot) {
  if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', tot];
  if (cur >= tot - 3) return [1, '...', tot - 4, tot - 3, tot - 2, tot - 1, tot];
  return [1, '...', cur - 1, cur, cur + 1, '...', tot];
}

function goPage(n) {
  page = n;
  renderGrid(); renderPagination(); renderCount();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ACTIVE FILTER CHIPS ───────────────────────────────────────────────────────
function renderActiveFilters() {
  const el = document.getElementById('activeFilters');
  if (!el) return;
  const chips = [];
  if (activeNiche !== 'todos') chips.push(
    `<span class="filter-chip">${nicheDisplayName(activeNiche)}<button onclick="setNiche('todos')" aria-label="Remover">✕</button></span>`
  );
  if (activePlatform !== 'todos') chips.push(
    `<span class="filter-chip">${esc(activePlatform)}<button onclick="setPlatform('todos')" aria-label="Remover">✕</button></span>`
  );
  activeOrigins.forEach(orig => chips.push(
    `<span class="filter-chip">${ORIGIN_NAMES[orig] || orig}<button onclick="removeOrigin('${orig}')" aria-label="Remover">✕</button></span>`
  ));
  activeCats.forEach(cat => chips.push(
    `<span class="filter-chip">${esc(cat)}<button onclick="removeCat('${esc(cat)}')" aria-label="Remover">✕</button></span>`
  ));
  if (activeDiscount !== 'todos') chips.push(
    `<span class="filter-chip">+${activeDiscount}% OFF<button onclick="setDiscount('todos')" aria-label="Remover">✕</button></span>`
  );
  if (priceFilterMin > priceRangeMin || priceFilterMax < priceRangeMax) chips.push(
    `<span class="filter-chip">Preço: ${fmtBRL(priceFilterMin)}–${fmtBRL(priceFilterMax)}<button onclick="resetPriceFilter()" aria-label="Remover">✕</button></span>`
  );
  if (searchQuery) chips.push(
    `<span class="filter-chip">Busca: "${esc(searchQuery)}"<button onclick="clearSearch()" aria-label="Remover">✕</button></span>`
  );
  el.innerHTML = chips.join('');
}

// ── MOBILE SIDEBAR ────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

loadProducts();
