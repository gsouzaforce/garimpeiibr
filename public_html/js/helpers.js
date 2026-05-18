/* ── NICHE MAP ─────────────────────────────────────────────────────────────────
   Chave = niche_id slug vindo do n8n (minúsculo)
   Adicione novos nichos conforme aparecerem nos produtos.               */
const NICHE_MAP = {
  'eletronicos':  { name: 'Eletrônicos',    color: '#00008c' },
  'beleza':       { name: 'Beleza',          color: '#cc0070' },
  'mercado':      { name: 'Mercado',         color: '#1a6b2e' },
  'casa':         { name: 'Casa & Cozinha',  color: '#c87800' },
  'moda':         { name: 'Moda',            color: '#5c0080' },
  'esportes':     { name: 'Esportes',        color: '#e8200c' },
  'informatica':  { name: 'Informática',     color: '#003494' },
  'games':        { name: 'Games',           color: '#1a0060' },
  'brinquedos':   { name: 'Brinquedos',     color: '#e87000' },
  'automotivo':   { name: 'Automotivo',      color: '#444444' },
};

/* Niche slug from niche_id field — no inference needed */
function detectNiche(nicheId) {
  const slug = (nicheId || '').toLowerCase().trim();
  return slug || 'outros';
}

function nicheDisplayName(slug) {
  return (NICHE_MAP[slug] || {}).name
    || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

/* Pac-man G logo in niche color with drop shadow */
function nicheLogo(slug) {
  const color = (NICHE_MAP[slug] || { color: '#888888' }).color;
  const fid   = `ns_${slug.replace(/[^a-z0-9]/g, '_')}`;
  return `<svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true" style="flex-shrink:0">
    <defs><filter id="${fid}" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="5" dy="6" stdDeviation="3" flood-color="rgba(0,0,0,0.28)" flood-opacity="1"/>
    </filter></defs>
    <path d="M 50 50 L 87 24 A 45 45 0 1 0 87 76 Z" fill="${color}" filter="url(#${fid})"/>
  </svg>`;
}

/* ── PLATFORM ──────────────────────────────────────────────────────────────── */
function detectPlatform(link) {
  if (!link) return 'Outro';
  const l = link.toLowerCase();
  if (l.includes('amazon.com.br') || l.includes('amzn.to')) return 'Amazon';
  if (l.includes('mercadolivre') || l.includes('meli.') || l.includes('mercadol')) return 'Mercado Livre';
  if (l.includes('shopee.com.br')) return 'Shopee';
  if (l.includes('magazinevoce') || l.includes('magazineluiza')) return 'Magazine Luiza';
  return 'Outro';
}

function storeClass(plat) {
  return { 'Amazon': 'amazon', 'Mercado Livre': 'ml', 'Shopee': 'shopee', 'Magazine Luiza': 'mag' }[plat] || 'outro';
}

const PLATFORM_LOGOS = {
  'Amazon': './assets/images/logo/amazon-logo.png',
  'Shopee': './assets/images/logo/shopee-logo.png',
  'Mercado Livre': './assets/images/logo/mercadolivre-logo.png',
  'Magazine Luiza': './assets/images/logo/magazineluiza-logo.png',
};

function platformLogo(plat) {
  const src = PLATFORM_LOGOS[plat];
  if (!src) return '';
  return `<img src="${src}" alt="${plat}" class="platform-logo-img">`;
}

/* ── FORMATTERS ─────────────────────────────────────────────────────────────── */
function fmtBRL(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v) {
  const n = parseInt(v);
  if (!n) return null;
  return n >= 1000 ? '+' + (n / 1000).toFixed(1).replace('.0', '') + 'k' : '+' + n;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* ── ORIGIN ──────────────────────────────────────────────────────────────── */
const ORIGIN_NAMES = { telegram: 'Telegram', whatsapp: 'WhatsApp', instagram: 'Instagram' };

function detectOrigin(p) {
  const raw = (p.source_channel || p.channel || p.source || p.origin || p.canal || p.origem || '').toLowerCase().trim();
  if (!raw) return null;
  if (raw.includes('telegram') || raw === 'tg') return 'telegram';
  if (raw.includes('whatsapp') || raw === 'wa' || raw === 'zap') return 'whatsapp';
  if (raw.includes('instagram') || raw === 'ig' || raw === 'insta') return 'instagram';
  return null;
}

function originIcon(slug, size = 12) {
  const icons = {
    telegram:  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.008 9.461c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.32 14.605l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.496.981z"/></svg>`,
    whatsapp:  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
    instagram: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  };
  return icons[slug] || '';
}

function fmtDate(p) {
  const raw = p.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const diff  = Date.now() - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'agora';
  if (mins  < 60) return `há ${mins}min`;
  if (hours < 24) return `há ${hours}h`;
  if (days  < 7)  return `há ${days} dia${days > 1 ? 's' : ''}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
