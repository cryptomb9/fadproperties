import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_IMAGE = "images/fad-showcase-house.jpeg";
const FALLBACK_LAND_IMAGE = "images/land-hero-nigeria-optimized.jpg";

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

async function loadProperty() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('title').textContent = "Invalid property";
    return;
  }

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error(error);
    document.getElementById('title').textContent = "Property Not Found";
    document.getElementById('description').textContent = "This listing could not be loaded. Please contact FAD HOMES AND PROPERTY for help.";
    return;
  }

  const title = data.title || 'Untitled Property';
  const isLand = data.listing_type === 'land' || String(data.category || '').toLowerCase().includes('land');
  const fallbackImage = isLand ? FALLBACK_LAND_IMAGE : FALLBACK_IMAGE;

  document.title = `${title} - FAD HOMES AND PROPERTY`;
  document.getElementById('title').textContent = title;
  document.getElementById('price').textContent = formatPrice(data.price);

  const copyIdBtn = document.getElementById('copy-listing-id');
  copyIdBtn.onclick = async () => {
    await copyText(id);
    copyIdBtn.textContent = 'Copied';
    window.setTimeout(() => (copyIdBtn.textContent = 'Copy ID'), 1200);
  };

  const facts = [
    data.location,
    data.category,
    isLand && data.size ? data.size : "",
    !isLand && data.bedrooms ? `${data.bedrooms} bed` : "",
    !isLand && data.bathrooms ? `${data.bathrooms} bath` : "",
  ].filter(Boolean);
  document.getElementById('property-meta').textContent = facts.join(" / ");
  document.getElementById('description').textContent = data.description || 'Speak with FAD HOMES AND PROPERTY for full details, inspection notes, and availability.';

  const badge = document.getElementById('status-badge');
  badge.textContent = data.status === 'Sold' ? 'Sold' : 'Available';
  badge.className = data.status === 'Sold' ? 'status-badge sold' : 'status-badge available';

  const buyBtn = document.getElementById('buy-button');
  if (data.status === 'Sold') {
    buyBtn.textContent = 'Sold';
    buyBtn.disabled = true;
  } else {
    buyBtn.onclick = () => {
      const listingUrl = `${window.location.origin}/property?id=${encodeURIComponent(id)}`;
      const msg = encodeURIComponent(`Hello FAD HOMES AND PROPERTY, I am interested in this ${isLand ? 'land' : 'property'}: ${title}\nListing ID: ${id}\n${listingUrl}`);
      window.open(`https://wa.me/2348145324251?text=${msg}`, '_blank');
    };
  }

  const swiperWrapper = document.getElementById('swiper-wrapper');
  const media = getPropertyMedia(data);
  const slides = media.length ? media : [{ url: fallbackImage, type: "image" }];
  swiperWrapper.innerHTML = slides.map(item => `
    <div class="swiper-slide">
      ${item.type === "video"
        ? `<video src="${escapeHtml(item.url)}" controls playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(title)}" loading="eager" decoding="async" fetchpriority="high" onerror="this.src='${fallbackImage}'"/>`
      }
    </div>
  `).join('');

  new Swiper('.swiper-container', {
    loop: slides.length > 1,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
  });
}

loadProperty();
