import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85";
const IS_PROPERTIES_PAGE = document.body.dataset.page === "properties";
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
  if (raw.includes("NGN") || raw.includes("₦")) return raw.replace("₦", "NGN ");
  return `NGN ${raw}`;
}

function shortText(value, limit = 118) {
  const text = String(value || "").trim();
  if (text.length <= limit) return text || "Speak with FAD HOMES AND PROPERTIES for full details, inspection notes, and availability.";
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

function renderShowcase(properties = []) {
  const track = document.getElementById("workShowcaseTrack");
  if (!track) return;

  const propertySlides = properties
    .filter((item) => getPropertyMedia(item).some((media) => media.type === "image"))
    .slice(0, 5)
    .map((item) => ({
      image: getPropertyMedia(item).find((media) => media.type === "image").url,
      title: item.title || "FAD project",
      text: item.description || "Listed and managed by FAD HOMES AND PROPERTIES.",
    }));

  const fallbackSlides = [
    {
      image: "images/fad-showcase-house.jpeg",
      title: "Modern Nigerian residence",
      text: "A finished contemporary home built for the kind of lifestyle and quality FAD HOMES AND PROPERTIES represents.",
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

async function loadListings() {
  const listings = document.getElementById('listings');
  if (!listings) return;

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Error loading listings:', error);
    listings.innerHTML = '<div class="empty-state">Error loading properties. Please try again.</div>';
    updateCount(0);
    return;
  }

  data.sort((a, b) => {
    if (a.status === 'Sold' && b.status !== 'Sold') return 1;
    if (a.status !== 'Sold' && b.status === 'Sold') return -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  allProperties = data;
  renderListings(data);
  renderShowcase(data);
}

function renderListings(list) {
  const listings = document.getElementById('listings');
  if (!listings) return;

  const displayList = IS_PROPERTIES_PAGE ? list : (list || []).slice(0, HOME_LISTING_LIMIT);
  updateCount(IS_PROPERTIES_PAGE ? (list?.length || 0) : Math.min(list?.length || 0, HOME_LISTING_LIMIT));

  if (!displayList || displayList.length === 0) {
    listings.innerHTML = '<div class="empty-state">No matching properties available right now.</div>';
    return;
  }

  listings.innerHTML = displayList
    .map((item) => {
      const media = getPropertyMedia(item);
      const firstMedia = media[0] || { url: FALLBACK_IMAGE, type: "image" };
      const status = item.status === "Sold" ? "Sold" : "Available";
      return `
        <article class="property-card">
          <div class="property-card-media">
            ${firstMedia.type === "video"
              ? `<video src="${escapeHtml(firstMedia.url)}" muted playsinline preload="metadata"></video><span class="media-chip">Video</span>`
              : `<img src="${escapeHtml(firstMedia.url)}" alt="${escapeHtml(item.title || 'Property image')}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">`
            }
            <span class="property-status">${status}</span>
          </div>
          <div class="property-card-body">
            <h3>${escapeHtml(item.title || 'Untitled Property')}</h3>
            <div class="property-price">${escapeHtml(formatPrice(item.price))}</div>
            <div class="property-meta">${escapeHtml(item.location || "Location on request")}${item.category ? ` • ${escapeHtml(item.category)}` : ""}</div>
            <p>${escapeHtml(shortText(item.description))}</p>
            <button type="button" onclick="location.href='/property?id=${encodeURIComponent(item.id)}'">View Details</button>
          </div>
        </article>
      `;
    })
    .join('') + (!IS_PROPERTIES_PAGE && list.length > HOME_LISTING_LIMIT
      ? `<div class="listing-more"><a href="/properties">View all ${list.length} properties</a></div>`
      : '');
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const words = query.split(/\s+/).filter(Boolean);
    const filtered = allProperties.filter((item) => {
      const haystack = searchableValue(item).toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    renderListings(filtered);
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
      <img src="${escapeHtml(promo.image_url)}" alt="FAD HOMES AND PROPERTIES promotion" style="width:100%;border-radius:6px;">
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

