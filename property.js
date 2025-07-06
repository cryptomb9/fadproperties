import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://gxozdkmphuneqglstlyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3pka21waHVuZXFnbHN0bHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MDgsImV4cCI6MjA2Njk5MTcwOH0.OmU29wRbQgZlWIjTVNr50W6dA0B3KtryW1dq0_cgRgs'
);

async function loadProperty() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) {
    alert('Invalid property ID.');
    return;
  }

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error(error);
    alert('Property not found or failed to load.');
    document.getElementById('title').textContent = "Property Not Found";
    return;
  }

  document.getElementById('title').textContent = data.title || 'Untitled Property';
  document.getElementById('price').textContent = `₦${data.price || 'N/A'}`;
  document.getElementById('description').textContent = data.description || 'No description available.';

  // Status badge
  const badge = document.getElementById('status-badge');
  badge.textContent = data.status === 'Sold' ? 'Sold' : 'Available';
  badge.className = data.status === 'Sold' ? 'status-badge sold' : 'status-badge available';

  // Buy button
  const buyBtn = document.getElementById('buy-button');
  if (data.status === 'Sold') {
    buyBtn.style.display = 'none';
  } else {
    buyBtn.onclick = () => {
      const msg = encodeURIComponent(`Hello, I'm interested in buying the property: ${data.title}`);
      window.open(`https://wa.me/2348145324251?text=${msg}`, '_blank');
    };
  }

  // Images
  const swiperWrapper = document.getElementById('swiper-wrapper');
  if (Array.isArray(data.images) && data.images.length) {
    swiperWrapper.innerHTML = data.images.map(url => `
      <div class="swiper-slide">
        <img src="${url}" alt="Property Image" style="width:100%;border-radius:8px;"/>
      </div>
    `).join('');
  } else {
    swiperWrapper.innerHTML = `<div>No images available.</div>`;
  }

  new Swiper('.swiper-container', {
    loop: true,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
  });
}

window.onload = loadProperty;
