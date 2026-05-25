import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85";

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
    document.getElementById('description').textContent = "This property could not be loaded. Please contact FAD Home and Properties for help.";
    return;
  }

  const title = data.title || 'Untitled Property';
  document.title = `${title} - FAD Home and Properties`;
  document.getElementById('title').textContent = title;
  document.getElementById('price').textContent = formatPrice(data.price);
  const facts = [
    data.location,
    data.category,
    data.bedrooms ? `${data.bedrooms} bed` : "",
    data.bathrooms ? `${data.bathrooms} bath` : "",
  ].filter(Boolean);
  document.getElementById('property-meta').textContent = facts.join(" • ");
  document.getElementById('description').textContent = data.description || 'Speak with FAD Home and Properties for full details, inspection notes, and availability.';

  const badge = document.getElementById('status-badge');
  badge.textContent = data.status === 'Sold' ? 'Sold' : 'Available';
  badge.className = data.status === 'Sold' ? 'status-badge sold' : 'status-badge available';

  const buyBtn = document.getElementById('buy-button');
  if (data.status === 'Sold') {
    buyBtn.textContent = 'Sold';
    buyBtn.disabled = true;
  } else {
    buyBtn.onclick = () => {
      const msg = encodeURIComponent(`Hello FAD Home and Properties, I am interested in this property: ${title}`);
      window.open(`https://wa.me/2349072654292?text=${msg}`, '_blank');
    };
  }

  const swiperWrapper = document.getElementById('swiper-wrapper');
  const media = getPropertyMedia(data);
  const slides = media.length ? media : [{ url: FALLBACK_IMAGE, type: "image" }];
  swiperWrapper.innerHTML = slides.map(item => `
    <div class="swiper-slide">
      ${item.type === "video"
        ? `<video src="${escapeHtml(item.url)}" controls playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(title)}" onerror="this.src='${FALLBACK_IMAGE}'"/>`
      }
    </div>
  `).join('');

  new Swiper('.swiper-container', {
    loop: slides.length > 1,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
  });
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

loadProperty();
