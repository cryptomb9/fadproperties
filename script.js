import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85";
const FALLBACK_LAND_IMAGE = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=85";
const PAGE_TYPE = document.body.dataset.page || "home";
const IS_PROPERTIES_PAGE = PAGE_TYPE === "properties";
const IS_LANDS_PAGE = PAGE_TYPE === "lands";
const HOME_LISTING_LIMIT = 6;

let allProperties = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  if (!value) return "Price on request";
  const raw = String(value).trim();
  if (raw.includes("NGN") || raw.includes("\u20a6")) return raw.replace("\u20a6", "NGN ");
  return `NGN ${raw}`;
}

function shortText(value, limit = 118) {
  const text = String(value || "").trim();
  if (text.length <= limit) return text || "Speak with FAD HOMES AND PROPERTY for full details, inspection notes, and availability.";
  return `${text.slice(0, limit).trim()}...`;
}

function updateCount(count) {
  const countEl = document.getElementById("listingCount");
  if (!countEl) return;
  countEl.textContent = `${count} ${count === 1 ? "listing" : "listings"}`;
}

function searchableValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(searchableValue).join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableValue).join(" ");
  return String(value);
}

function listingType(item) {
  if (item?.listing_type === "land") return "land";
  const category = String(item?.category || "").toLowerCase();
  return category.includes("land") ? "land" : "property";
}

function visibleForPage(item) {
  const type = listingType(item);
  if (IS_LANDS_PAGE) return type === "land";
  if (IS_PROPERTIES_PAGE) return type !== "land";
  return true;
}

function parsePriceValue(value) {
  const raw = String(value || "").toLowerCase().replace(/,/g, "").trim();
  const compact = raw.match(/(\d+(?:\.\d+)?)\s*(b|bn|billion|m|mn|million)\b/);
  if (compact) {
    const amount = Number(compact[1]);
    return compact[2].startsWith("b") ? amount * 1000000000 : amount * 1000000;
  }

  const digits = raw.replace(/[^\d.]/g, "");
  return digits ? Number(digits) : null;
}

function matchesPriceRange(item, rangeValue) {
  if (!rangeValue) return true;
  const price = parsePriceValue(item.price);
  if (!price) return false;
  const [minRaw, maxRaw] = rangeValue.split("-");
  const min = minRaw ? Number(minRaw) : 0;
  const max = maxRaw ? Number(maxRaw) : Infinity;
  return price >= min && price <= max;
}

function matchesBedroomCount(item, value) {
  if (!value) return true;
  const bedrooms = Number(item.bedrooms || 0);
  if (value.endsWith("+")) return bedrooms >= Number(value.replace("+", ""));
  return bedrooms === Number(value);
}

function applyFilters() {
  const query = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const category = document.getElementById("categoryFilter")?.value.toLowerCase().trim() || "";
  const bedroom = document.getElementById("bedroomFilter")?.value || "";
  const priceRange = document.getElementById("priceFilter")?.value || "";
  const locationFilter = document.getElementById("locationFilter")?.value.toLowerCase().trim() || "";
  const documentFilter = document.getElementById("documentFilter")?.value.toLowerCase().trim() || "";
  const sizeFilter = document.getElementById("sizeFilter")?.value.toLowerCase().trim() || "";
  const words = query.split(/\s+/).filter(Boolean);

  const filtered = allProperties.filter((item) => {
    if (!visibleForPage(item)) return false;
    const haystack = searchableValue(item).toLowerCase();
    const itemCategory = String(item.category || "").toLowerCase();
    const itemLocation = String(item.location || "").toLowerCase();
    const itemSize = String(item.size || "").toLowerCase();
    const categoryMatch = !category || itemCategory.includes(category) || haystack.includes(category);
    const locationMatch = !locationFilter || itemLocation.includes(locationFilter) || haystack.includes(locationFilter);
    const documentMatch = !documentFilter || itemCategory.includes(documentFilter) || haystack.includes(documentFilter);
    const sizeMatch = !sizeFilter || itemSize.includes(sizeFilter) || haystack.includes(sizeFilter);

    return words.every((word) => haystack.includes(word))
      && categoryMatch
      && locationMatch
      && documentMatch
      && sizeMatch
      && matchesBedroomCount(item, bedroom)
      && matchesPriceRange(item, priceRange);
  });

  renderListings(filtered);
}

function renderShowcase(properties = []) {
  const track = document.getElementById("workShowcaseTrack");
  if (!track) return;

  const propertySlides = properties
    .filter((item) => getPropertyMedia(item).some((media) => media.type === "image"))
    .slice(0, 5)
    .map((item) => ({
      image: getPropertyMedia(item).find((media) => media.type === "image").url,
      title: item.title || "FAD project",
      text: item.description || "Listed and managed by FAD HOMES AND PROPERTY.",
    }));

  const fallbackSlides = [
    {
      image: "images/fad-showcase-house.jpeg",
      title: "Modern Nigerian residence",
      text: "A finished contemporary home built for the kind of lifestyle and quality FAD HOMES AND PROPERTY represents.",
    },
    {
      image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=85",
      title: "Development support",
      text: "Property build support for clients moving from land to finished structure.",
    },
    {
      image: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85",
      title: "Modern spaces",
      text: "Spaces presented with the clarity buyers and tenants expect.",
    },
  ];

  const slides = propertySlides.length ? propertySlides : fallbackSlides;
  track.innerHTML = slides.map((slide, index) => `
    <article class="work-slide ${index === 0 ? "is-active" : ""}">
      <img src="${escapeHtml(slide.image)}" alt="${escapeHtml(slide.title)}" loading="lazy">
      <div>
        <span>0${index + 1}</span>
        <h3>${escapeHtml(slide.title)}</h3>
        <p>${escapeHtml(shortText(slide.text, 130))}</p>
      </div>
    </article>
  `).join("");

  let active = 0;
  const items = [...track.querySelectorAll(".work-slide")];
  if (items.length <= 1) return;
  window.setInterval(() => {
    items[active].classList.remove("is-active");
    active = (active + 1) % items.length;
    items[active].classList.add("is-active");
  }, 4300);
}

function getPropertyMedia(item) {
  if (Array.isArray(item.media) && item.media.length) {
    return item.media
      .filter((entry) => entry?.url)
      .map((entry) => ({
        url: String(entry.url),
        type: entry.type === "video" ? "video" : "image",
      }));
  }
  const images = Array.isArray(item.images) ? item.images : [];
  return images.map((url) => ({ url, type: "image" }));
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  return Promise.resolve();
}

async function loadListings() {
  const listings = document.getElementById('listings');
  if (!listings) return;

  let response;
  try {
    response = await Promise.race([
      supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false }),
      new Promise((resolve) => {
        window.setTimeout(() => resolve({
          data: null,
          error: { message: 'Connection timed out while loading properties.' },
        }), 12000);
      }),
    ]);
  } catch (error) {
    response = { data: null, error };
  }

  const { data, error } = response;

  if (error || !data) {
    console.error('Error loading listings:', error);
    listings.innerHTML = '<div class="empty-state">Could not load listings right now. Please refresh or try again shortly.</div>';
    updateCount(0);
    return;
  }

  data.sort((a, b) => {
    if (a.status === 'Sold' && b.status !== 'Sold') return 1;
    if (a.status !== 'Sold' && b.status === 'Sold') return -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  allProperties = data;
  applyFilters();
  renderShowcase(data.filter((item) => listingType(item) !== "land"));
}

function renderListings(list) {
  const listings = document.getElementById('listings');
  if (!listings) return;

  const displayList = (IS_PROPERTIES_PAGE || IS_LANDS_PAGE) ? list : (list || []).slice(0, HOME_LISTING_LIMIT);
  updateCount((IS_PROPERTIES_PAGE || IS_LANDS_PAGE) ? (list?.length || 0) : Math.min(list?.length || 0, HOME_LISTING_LIMIT));

  if (!displayList || displayList.length === 0) {
    listings.innerHTML = '<div class="empty-state">No matching properties available right now.</div>';
    return;
  }

  listings.innerHTML = displayList
    .map((item) => {
      const media = getPropertyMedia(item);
      const isLand = listingType(item) === "land";
      const firstMedia = media[0] || { url: isLand ? FALLBACK_LAND_IMAGE : FALLBACK_IMAGE, type: "image" };
      const status = item.status === "Sold" ? "Sold" : "Available";
      const meta = [
        item.location || "Location on request",
        item.category,
        isLand && item.size ? item.size : "",
        !isLand && item.bedrooms ? `${item.bedrooms} bed` : "",
      ].filter(Boolean).join(" / ");

      return `
        <article class="property-card">
          <div class="property-card-media">
            ${firstMedia.type === "video"
              ? `<video src="${escapeHtml(firstMedia.url)}" muted playsinline preload="metadata"></video><span class="media-chip">Video</span>`
              : `<img src="${escapeHtml(firstMedia.url)}" alt="${escapeHtml(item.title || 'Property image')}" loading="lazy" onerror="this.src='${isLand ? FALLBACK_LAND_IMAGE : FALLBACK_IMAGE}'">`
            }
            <span class="property-status">${status}</span>
          </div>
          <div class="property-card-body">
            <h3>${escapeHtml(item.title || 'Untitled Property')}</h3>
            <div class="public-listing-id">
              <button type="button" class="copy-public-id" data-id="${escapeHtml(item.id)}">Copy ID</button>
            </div>
            <div class="property-price">${escapeHtml(formatPrice(item.price))}</div>
            <div class="property-meta">${escapeHtml(meta)}</div>
            <p>${escapeHtml(shortText(item.description))}</p>
            <button type="button" onclick="location.href='/property?id=${encodeURIComponent(item.id)}'">${isLand ? "View Land" : "View Details"}</button>
          </div>
        </article>
      `;
    })
    .join('') + (!(IS_PROPERTIES_PAGE || IS_LANDS_PAGE) && list.length > HOME_LISTING_LIMIT
      ? `<div class="listing-more"><a href="/properties">View Properties</a><a href="/lands">View Land</a></div>`
      : '');
}

const searchInput = document.getElementById('searchInput');
if (searchInput) searchInput.addEventListener('input', applyFilters);

const listingsEl = document.getElementById('listings');
if (listingsEl) {
  listingsEl.addEventListener('click', async (event) => {
    if (!event.target.classList.contains('copy-public-id')) return;
    event.preventDefault();
    event.stopPropagation();
    await copyText(event.target.dataset.id);
    event.target.textContent = 'Copied';
    window.setTimeout(() => (event.target.textContent = 'Copy ID'), 1200);
  });
}

["categoryFilter", "bedroomFilter", "priceFilter", "locationFilter", "documentFilter", "sizeFilter"].forEach((id) => {
  const control = document.getElementById(id);
  if (control) control.addEventListener("change", applyFilters);
});

const clearFiltersBtn = document.getElementById("clearFilters");
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    ["searchInput", "categoryFilter", "bedroomFilter", "priceFilter", "locationFilter", "documentFilter", "sizeFilter"].forEach((id) => {
      const control = document.getElementById(id);
      if (control) control.value = "";
    });
    applyFilters();
  });
}

async function loadPromoPopup() {
  const { data, error } = await supabase
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return;

  const promo = data[0];
  const overlay = document.createElement('div');
  overlay.className = "modal";
  overlay.style.display = "flex";
  overlay.innerHTML = `
    <div class="modal-content" style="padding:10px;max-width:720px;">
      <span class="close-btn" id="closePromo">&times;</span>
      <img src="${escapeHtml(promo.image_url)}" alt="FAD HOMES AND PROPERTY promotion" style="width:100%;border-radius:6px;">
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById('closePromo').addEventListener('click', () => overlay.remove());
}

const modal = document.getElementById('admin-login-modal');
const loginBtn = document.querySelector('.admin-login-btn');
const closeBtn = document.querySelector('.close-btn');
const loginForm = document.getElementById('admin-login-form');

if (loginBtn && modal) {
  loginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    modal.style.display = 'flex';
  });
}

if (closeBtn && modal) closeBtn.addEventListener('click', () => (modal.style.display = 'none'));

if (modal) {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.style.display = 'none';
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    const errorMessage = document.getElementById('error-message');

    if (errorMessage) errorMessage.style.display = 'none';
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';

    if (error) {
      console.error(error);
      errorMessage.style.display = 'block';
      return;
    }

    modal.style.display = 'none';
    window.location.href = '/admin';
  });
}

loadListings();
renderShowcase();
if (document.getElementById('listings')) loadPromoPopup();
