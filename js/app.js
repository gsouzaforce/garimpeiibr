const PER_PAGE = 20;

let allProducts = [], filteredProducts = [];
let page = 1;
let activeNiche = 'todos', activePlatform = 'todos', activeCats = [], activeOrigins = [];
let activeSort  = 'recentes', searchQuery = '';
let discountMin = null, discountMax = null;
let priceMin    = null, priceMax    = null;
let minRating   = 0;
let searchTimer;

// ── CACHE ─────────────────────────────────────────────────────────────────────
const CACHE_KEY = 'garimpeii_v1';

function saveCache(raw) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: raw })); } catch (_) {}
}

function loadCache() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return null;
    const { ts, data } = JSON.parse(s);
    return { data, age: Date.now() - ts };
  } catch (_) { return null; }
}

function applyFromRaw(raw) {
  allProducts = raw.map(p => ({
    ...p,
    _platform: detectPlatform(p.platform),
    _niche:    detectNiche(p.niche_id),
    _origin:   detectOrigin(p),
  }));
  buildFilters();
  applyFilters();
}

function fmtCacheAge(ms) {
  const mins  = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  if (mins  <  1) return 'agora há pouco';
  if (mins  < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  return 'há mais de um dia';
}

function showCacheBanner(ageMs, isError = false) {
  const el = document.getElementById('cacheBanner');
  if (!el) return;
  const age  = fmtCacheAge(ageMs);
  const spinner   = `<svg class="cache-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke-opacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>`;
  const alertIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  el.innerHTML = isError
    ? `${alertIcon}<span class="cache-banner-msg">Falha ao atualizar — exibindo dados de <b>${age}</b></span><button class="cache-retry-btn" onclick="loadProducts()">Tentar novamente</button>`
    : `${spinner}<span class="cache-banner-msg">Atualizando ofertas — exibindo dados de <b>${age}</b></span>`;
  el.style.display = 'flex';
}

function hideCacheBanner() {
  const el = document.getElementById('cacheBanner');
  if (el) el.style.display = 'none';
}

// ── LOAD ─────────────────────────────────────────────────────────────────────
async function loadProducts(attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY  = [0, 3000, 8000];
  const cached = loadCache();

  // Mostra cache imediatamente enquanto busca dados frescos
  if (attempt === 1 && cached) {
    applyFromRaw(cached.data);
    showCacheBanner(cached.age);
  }

  try {
    const raw = await fetchProducts();
    saveCache(raw);
    applyFromRaw(raw);
    hideCacheBanner();
  } catch (e) {
    if (cached) {
      showCacheBanner(cached.age, true);
      return;
    }
    if (attempt < MAX_ATTEMPTS) {
      document.getElementById('grid').innerHTML = `
        <div class="estado">
          <div class="load-ring"></div>
          <p>Buscando ofertas… (tentativa ${attempt + 1} de ${MAX_ATTEMPTS})</p>
        </div>`;
      setTimeout(() => loadProducts(attempt + 1), RETRY_DELAY[attempt]);
      return;
    }
    document.getElementById('grid').innerHTML = `
      <div class="estado">
        <span class="estado-ico">⚠️</span>
        <p>Não foi possível carregar os produtos.</p>
        <small>Verifique sua conexão ou tente novamente em instantes.</small>
        <button class="btn-retry" onclick="loadProducts()">Tentar novamente</button>
      </div>`;
  }
}

// ── BUILD SIDEBAR ─────────────────────────────────────────────────────────────
function buildFilters() {
  const nichoCounts = {}, platCounts = {}, catCounts = {};
  allProducts.forEach(p => {
    nichoCounts[p._niche]   = (nichoCounts[p._niche]   || 0) + 1;
    platCounts[p._platform] = (platCounts[p._platform] || 0) + 1;
    if (p.category) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  });

  // Nicho
  const niches = ['todos', ...Object.entries(nichoCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  document.getElementById('nichoFilters').innerHTML = niches.map(v => `
    <div class="sidebar-item ${activeNiche === v ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setNiche('${esc(v)}')">
      ${v !== 'todos' ? nicheLogo(v) : ''}
      <span class="sidebar-label">${v === 'todos' ? 'Todos' : nicheDisplayName(v)}</span>
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (nichoCounts[v] || 0)}</span>
    </div>`).join('');

  // Plataforma
  const plats = ['todos', ...Object.entries(platCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  document.getElementById('platFilters').innerHTML = plats.map(v => `
    <div class="sidebar-item ${activePlatform === v ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setPlatform('${esc(v)}')">
      ${v !== 'todos' ? platformLogo(v) : ''}
      ${v === 'todos' ? '<span class="sidebar-label">Todas</span>' : ''}
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (platCounts[v] || 0)}</span>
    </div>`).join('');

  // Categoria (multi-select)
  const cats = ['todos', ...Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  document.getElementById('catFilters').innerHTML = cats.map(v => {
    const isActive = v === 'todos' ? activeCats.length === 0 : activeCats.includes(v);
    return `<div class="sidebar-item ${isActive ? 'ativo' : ''}" data-value="${esc(v)}" onclick="setCat('${esc(v)}')">
      <span class="sidebar-label">${v === 'todos' ? 'Todas' : esc(v)}</span>
      <span class="sidebar-count">${v === 'todos' ? allProducts.length : (catCounts[v] || 0)}</span>
    </div>`;
  }).join('');

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

// ── DISCOUNT INPUTS ───────────────────────────────────────────────────────────
function onDiscountMin(v) {
  discountMin = v === '' ? null : Math.max(0, Math.min(100, parseInt(v) || 0));
  page = 1; updateActiveFilterCount(); applyFilters();
}

function onDiscountMax(v) {
  discountMax = v === '' ? null : Math.max(0, Math.min(100, parseInt(v) || 0));
  page = 1; updateActiveFilterCount(); applyFilters();
}

function resetDiscountFilter() {
  discountMin = null; discountMax = null;
  const minEl = document.getElementById('discountMinInput');
  const maxEl = document.getElementById('discountMaxInput');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  page = 1; updateActiveFilterCount(); applyFilters();
}

// ── PRICE INPUTS ──────────────────────────────────────────────────────────────
function onPriceMinInput(v) {
  priceMin = v === '' ? null : Math.max(0, parseFloat(v) || 0);
  page = 1; updateActiveFilterCount(); applyFilters();
}

function onPriceMaxInput(v) {
  priceMax = v === '' ? null : Math.max(0, parseFloat(v) || 0);
  page = 1; updateActiveFilterCount(); applyFilters();
}

function resetPriceInputFilter() {
  priceMin = null; priceMax = null;
  const minEl = document.getElementById('priceMinInput');
  const maxEl = document.getElementById('priceMaxInput');
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';
  page = 1; updateActiveFilterCount(); applyFilters();
}

// ── RATING FILTER ─────────────────────────────────────────────────────────────
function setMinRating(v) {
  minRating = v;
  document.querySelectorAll('#ratingFilters .sidebar-item').forEach(el =>
    el.classList.toggle('ativo', parseInt(el.dataset.value) === v)
  );
  page = 1; updateActiveFilterCount(); applyFilters();
}

// ── RESET ─────────────────────────────────────────────────────────────────────
function resetFilters() {
  activeNiche = 'todos'; activePlatform = 'todos';
  activeCats = []; activeOrigins = [];
  activeSort = 'recentes'; searchQuery = '';
  discountMin = null; discountMax = null;
  priceMin = null; priceMax = null;
  minRating = 0;
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  const sel = document.getElementById('sortSelect');
  if (sel) sel.value = 'recentes';
  ['discountMinInput', 'discountMaxInput', 'priceMinInput', 'priceMaxInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  page = 1;
  buildFilters();
  setMinRating(0);
  applyFilters();
}

function clearSearch() {
  searchQuery = '';
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  page = 1;
  applyFilters();
}

// ── ACTIVE FILTER COUNT ────────────────────────────────────────────────────────
function updateActiveFilterCount() {
  let count = 0;
  if (activeNiche    !== 'todos') count++;
  if (activePlatform !== 'todos') count++;
  if (activeCats.length    > 0)   count++;
  if (activeOrigins.length > 0)   count++;
  if (discountMin !== null || discountMax !== null) count++;
  if (priceMin    !== null || priceMax    !== null) count++;
  if (minRating > 0)  count++;
  if (searchQuery)    count++;
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
  filteredProducts = allProducts.filter(p => {
    if (activeNiche    !== 'todos' && p._niche    !== activeNiche)         return false;
    if (activePlatform !== 'todos' && p._platform !== activePlatform)      return false;
    if (activeCats.length    > 0   && !activeCats.includes(p.category))   return false;
    if (activeOrigins.length > 0   && !activeOrigins.includes(p._origin)) return false;
    if (discountMin !== null && (p.discount || 0) < discountMin)           return false;
    if (discountMax !== null && (p.discount || 0) > discountMax)           return false;
    if (priceMin !== null && p.price > 0 && p.price < priceMin)            return false;
    if (priceMax !== null && p.price > 0 && p.price > priceMax)            return false;
    if (minRating > 0 && (p.rating_star || 0) < minRating)                return false;
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
    const sc         = storeClass(p._platform);
    const hasDisc    = p.discount > 0;
    const hasPrice   = p.price > 0;
    const saving     = hasDisc && p.list_price > 0 ? fmtBRL(p.list_price - p.price) : null;
    const rev        = fmtNum(p.reviews);
    const dateStr    = fmtDate(p);
    const logo       = platformLogo(p._platform);
    const origin     = p._origin;

    const originPill = origin
      ? `<span class="origin-pill origin-${origin}">${originIcon(origin, 10)}<span>${ORIGIN_NAMES[origin]}</span></span>`
      : '';
    const datePill = dateStr
      ? `<span class="card-date"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${dateStr}</span>`
      : '';

    let priceChangeBadge = '';
    if (p.price_change_type && (p.price_difference || p.price_difference_percentage)) {
      const isDown  = p.price_change_type === 'price_decreased';
      const cls     = isDown ? 'price-change-down' : 'price-change-up';
      const arrow   = isDown ? '↓' : '↑';
      const verb    = isDown ? 'Baixou' : 'Subiu';
      const sign    = isDown ? '-' : '+';
      const diffStr = p.price_difference ? fmtBRL(Math.abs(p.price_difference)) : '';
      const pctStr  = p.price_difference_percentage ? Math.abs(Math.round(p.price_difference_percentage)) + '%' : '';
      const prevStr = p.previous_price ? fmtBRL(p.previous_price) : 'valor anterior';
      const tooltip = isDown
        ? `Preço caiu de ${prevStr} para o valor atual`
        : `Preço subiu de ${prevStr} para o valor atual`;
      const detail = [diffStr, pctStr ? `(${pctStr})` : ''].filter(Boolean).join(' ');
      priceChangeBadge = `<div class="price-change ${cls}" title="${esc(tooltip)}">${arrow} ${verb}${detail ? ': ' + sign + detail : ''} <span class="price-change-info" aria-hidden="true">ⓘ</span></div>`;
    }

    const isHotDeal = hasDisc && p.discount > 50;
    return `<div class="card${isHotDeal ? ' card--fire' : ''}">
      ${isHotDeal ? `<div class="fire-banner">🔥 -${Math.round(p.discount)}% · IMPERDÍVEL 🔥</div>` : ''}
      <div class="card-img">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="${esc(p.product_name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <span class="card-img-placeholder" style="${p.image_url ? 'display:none' : 'display:flex'}">📦</span>
        ${hasDisc ? `<span class="discount-badge">-${Math.round(p.discount)}%</span>` : ''}
        <span class="store-badge store-${sc}">${logo}</span>
      </div>
      <div class="card-body">
        ${priceChangeBadge}
        ${p.category ? `<div class="card-cat">${esc(p.category)}</div>` : ''}
        <p class="card-name">${esc(p.product_name)}</p>
        ${(originPill || datePill) ? `<div class="card-footer">${originPill}${datePill}</div>` : ''}
        ${p.rating_star > 0 ? `<div class="card-rating"><span class="rating-stars">★ ${p.rating_star}</span>${rev ? `<span>${rev} avaliações</span>` : ''}</div>` : ''}
        <div class="card-price">
          ${hasPrice ? `<div class="price-current">${fmtBRL(p.price)}</div>` : ''}
          ${hasDisc && p.list_price > 0 ? `<div class="price-original">de ${fmtBRL(p.list_price)}</div>` : ''}
          ${saving ? `<div class="price-saving">Economia de ${saving}</div>` : ''}
        </div>
        <a href="${esc(p.affiliate_link)}" target="_blank" rel="noopener sponsored" class="btn-deal">
          Ver oferta
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
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
  if (discountMin !== null || discountMax !== null) {
    const lo = discountMin ?? 0, hi = discountMax ?? 100;
    chips.push(`<span class="filter-chip">Desconto: ${lo}%–${hi}%<button onclick="resetDiscountFilter()" aria-label="Remover">✕</button></span>`);
  }
  if (priceMin !== null || priceMax !== null) {
    const lo = priceMin !== null ? fmtBRL(priceMin) : 'R$ 0';
    const hi = priceMax !== null ? fmtBRL(priceMax) : '∞';
    chips.push(`<span class="filter-chip">Preço: ${lo}–${hi}<button onclick="resetPriceInputFilter()" aria-label="Remover">✕</button></span>`);
  }
  if (minRating > 0) chips.push(
    `<span class="filter-chip">${minRating}+ estrelas<button onclick="setMinRating(0)" aria-label="Remover">✕</button></span>`
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
