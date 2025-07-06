import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://gxozdkmphuneqglstlyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3pka21waHVuZXFnbHN0bHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MDgsImV4cCI6MjA2Njk5MTcwOH0.OmU29wRbQgZlWIjTVNr50W6dA0B3KtryW1dq0_cgRgs'
);

// Admin credentials
const ADMIN_EMAIL = "admin@yourproperty.com";
const ADMIN_PASSWORD = "admin123";

let allProperties = [];

async function loadListings() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  const listings = document.getElementById('listings');

  if (error || !data) {
    console.error('Error loading listings:', error);
    listings.innerHTML = '<p>Error loading properties. Please try again.</p>';
    return;
  }

  data.sort((a, b) => {
    if (a.status === 'Sold' && b.status !== 'Sold') return 1;
    if (a.status !== 'Sold' && b.status === 'Sold') return -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  allProperties = data;
  renderListings(data);
}

function renderListings(list) {
  const listings = document.getElementById('listings');

  if (!list || list.length === 0) {
    listings.innerHTML = '<p>No properties available.</p>';
    return;
  }

  listings.innerHTML = list
    .map((item) => {
      let images = item.images || [];

      return `
        <div class="property-card">
          <h3>${item.title || 'Untitled'}</h3>
          <p>Price: ₦${item.price || 'N/A'}</p>
          <div class="image-gallery">
            ${images
              .slice(0, 3)
              .map(
                (img) =>
                  `<img src="${img}" alt="Property Image" width="100" loading="lazy" onerror="this.src='/images/placeholder.jpg'">`
              )
              .join('')}
          </div>
          <button onclick="location.href='property.html?id=${item.id}'">See Details</button>
        </div>
      `;
    })
    .join('');
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allProperties.filter(
      (item) =>
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query))
    );
    renderListings(filtered);
  });
}

// Promo popup
async function loadPromoPopup() {
  const { data, error } = await supabase
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.log('No promos to display.');
    return;
  }

  const promo = data[0];

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';

  overlay.innerHTML = `
    <div style="position: relative; max-width: 90%; max-height: 90%;">
      <img src="${promo.image_url}" alt="Promo" style="max-width:100%; border-radius:8px;">
      <button id="closePromo" style="
        position: absolute;
        top: -10px;
        right: -10px;
        background: #fff;
        color: #000;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 16px;
        font-weight:bold;
      ">×</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('closePromo').addEventListener('click', () => {
    overlay.remove();
  });
}

// Admin login modal logic
const modal = document.getElementById('admin-login-modal');
const loginBtn = document.querySelector('.admin-login-btn');
const closeBtn = document.querySelector('.close-btn');
const loginForm = document.getElementById('admin-login-form');

if (loginBtn) loginBtn.addEventListener('click', () => (modal.style.display = 'flex'));
if (closeBtn) closeBtn.addEventListener('click', () => (modal.style.display = 'none'));

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    const errorMessage = document.getElementById('error-message');

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      modal.style.display = 'none';
      window.location.href = 'admin.html';
    } else {
      errorMessage.style.display = 'block';
    }
  });
}

window.onload = () => {
  loadListings();
  loadPromoPopup();
};
