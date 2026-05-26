import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const propertyForm = document.getElementById('propertyForm');
const landForm = document.getElementById('landForm');
const promoForm = document.getElementById('promoForm');
const logoutBtn = document.getElementById('logoutBtn');
const adminLoginPanel = document.getElementById('adminLoginPanel');
const adminDashboard = document.getElementById('adminDashboard');
const adminLoginForm = document.getElementById('admin-login-form');
const errorMessage = document.getElementById('error-message');

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function listingType(item) {
  if (item?.listing_type === 'land') return 'land';
  return String(item?.category || '').toLowerCase().includes('land') ? 'land' : 'property';
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
  });
}

function showLogin() {
  if (adminLoginPanel) adminLoginPanel.style.display = 'grid';
  if (adminDashboard) adminDashboard.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
}

function showDashboard() {
  if (adminLoginPanel) adminLoginPanel.style.display = 'none';
  if (adminDashboard) adminDashboard.style.display = 'block';
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';
}

async function requireAdminSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    showLogin();
    return false;
  }

  const { data, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .single();

  if (adminError || !data) {
    await supabase.auth.signOut();
    showLogin();
    return false;
  }

  showDashboard();
  return true;
}

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorMessage) errorMessage.style.display = 'none';

    const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const email = adminLoginForm.querySelector('input[type="email"]').value.trim();
    const password = adminLoginForm.querySelector('input[type="password"]').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';

    if (error) {
      console.error(error);
      if (errorMessage) errorMessage.style.display = 'block';
      return;
    }

    if (await requireAdminSession()) {
      loadProperties();
      loadPromos();
    }
  });
}

async function uploadMediaFiles(files, submitBtn, buttonText) {
  const media = [];
  const imageUrls = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
    const isVideo = file.type.startsWith('video/');
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(`public/${Date.now()}_${safeName}`, file);

    if (error) {
      console.error(error);
      submitBtn.disabled = false;
      submitBtn.textContent = buttonText;
      throw new Error('Media upload failed: ' + error.message);
    }

    const { data: publicData } = supabase
      .storage
      .from('property-images')
      .getPublicUrl(data.path);

    if (!publicData?.publicUrl) {
      submitBtn.disabled = false;
      submitBtn.textContent = buttonText;
      throw new Error('Could not get public URL.');
    }

    media.push({
      url: publicData.publicUrl,
      type: isVideo ? 'video' : 'image',
    });
    if (!isVideo) imageUrls.push(publicData.publicUrl);
  }

  return { media, imageUrls };
}

propertyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = propertyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing...';

  const title = document.getElementById('title').value.trim();
  const location = document.getElementById('location').value.trim();
  const category = document.getElementById('category').value.trim();
  const bedrooms = document.getElementById('bedrooms').value;
  const bathrooms = document.getElementById('bathrooms').value;
  const description = document.getElementById('description').value.trim();
  const price = document.getElementById('price').value.trim();
  const files = document.getElementById('media').files;

  if (!title || !location || !category || !description || !price || files.length === 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Property';
    alert('Fill all required fields and select at least one image or video.');
    return;
  }

  let uploaded;
  try {
    uploaded = await uploadMediaFiles(files, submitBtn, 'Publish Property');
  } catch (error) {
    alert(error.message);
    return;
  }

  const { error: insertError } = await supabase
    .from('properties')
    .insert([{
      listing_type: 'property',
      title,
      location,
      category,
      bedrooms: bedrooms ? Number(bedrooms) : null,
      bathrooms: bathrooms ? Number(bathrooms) : null,
      description,
      price,
      images: uploaded.imageUrls,
      media: uploaded.media,
      status: 'Available'
    }]);

  if (insertError) {
    console.error(insertError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Property';
    alert('Failed to save property: ' + insertError.message);
    return;
  }

  propertyForm.reset();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Publish Property';
  loadProperties();
});

landForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = landForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing...';

  const title = document.getElementById('landTitle').value.trim();
  const location = document.getElementById('landLocation').value.trim();
  const category = document.getElementById('landCategory').value.trim();
  const size = document.getElementById('landSize').value.trim();
  const description = document.getElementById('landDescription').value.trim();
  const price = document.getElementById('landPrice').value.trim();
  const files = document.getElementById('landMedia').files;

  if (!title || !location || !category || !size || !description || !price) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Land';
    alert('Fill all land fields.');
    return;
  }

  let uploaded = { media: [], imageUrls: [] };
  if (files.length > 0) {
    try {
      uploaded = await uploadMediaFiles(files, submitBtn, 'Publish Land');
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  const { error: insertError } = await supabase
    .from('properties')
    .insert([{
      listing_type: 'land',
      title,
      location,
      category,
      size,
      bedrooms: null,
      bathrooms: null,
      description,
      price,
      images: uploaded.imageUrls,
      media: uploaded.media,
      status: 'Available'
    }]);

  if (insertError) {
    console.error(insertError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Land';
    alert('Failed to save land: ' + insertError.message);
    return;
  }

  landForm.reset();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Publish Land';
  loadProperties();
});

async function loadProperties() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('properties-container');
  if (error) {
    console.error(error);
    container.innerHTML = '<p>Error loading properties.</p>';
    return;
  }

  const totalEl = document.getElementById('totalProperties');
  const landsEl = document.getElementById('totalLands');
  const availableEl = document.getElementById('availableProperties');
  const soldEl = document.getElementById('soldProperties');
  if (totalEl && landsEl && availableEl && soldEl) {
    const items = data || [];
    totalEl.textContent = String(items.filter((item) => listingType(item) !== 'land').length);
    landsEl.textContent = String(items.filter((item) => listingType(item) === 'land').length);
    availableEl.textContent = String(items.filter((item) => item.status !== 'Sold').length);
    soldEl.textContent = String(items.filter((item) => item.status === 'Sold').length);
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>No properties yet.</p>';
    return;
  }

  container.innerHTML = data.map((item) => `
    <article class="admin-property-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(listingType(item) === 'land' ? 'Land' : 'Property')} / ${escapeHtml(item.location || 'Location not set')}</p>
      <p>${escapeHtml([item.category, item.size].filter(Boolean).join(' / ') || 'Category not set')}</p>
      <p>${escapeHtml(item.description || '').slice(0, 170)}${(item.description || '').length > 170 ? '...' : ''}</p>
      <p>Status: <strong>${escapeHtml(item.status || 'Available')}</strong></p>
      <div class="admin-actions">
        <button class="toggle-status-btn" data-id="${item.id}" data-status="${escapeHtml(item.status || 'Available')}">
          Mark as ${item.status === 'Sold' ? 'Available' : 'Sold'}
        </button>
        <button class="delete-property-btn" data-id="${item.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

document.getElementById('properties-container').addEventListener('click', async (e) => {
  if (e.target.classList.contains('toggle-status-btn')) {
    await toggleStatus(e.target.dataset.id, e.target.dataset.status);
  }
  if (e.target.classList.contains('delete-property-btn')) {
    await deleteProperty(e.target.dataset.id);
  }
});

async function toggleStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Sold' ? 'Available' : 'Sold';
  const { error } = await supabase
    .from('properties')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Failed to update status.');
    return;
  }
  loadProperties();
}

async function deleteProperty(id) {
  if (!confirm('Delete this property?')) return;
  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Failed to delete.');
    return;
  }
  loadProperties();
}

promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = promoForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  const file = document.getElementById('promoImage').files[0];
  if (!file) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    alert('Select an image.');
    return;
  }

  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
  const { data, error } = await supabase.storage
    .from('promo-images')
    .upload(`public/${Date.now()}_${safeName}`, file);

  if (error) {
    console.error('Upload error:', error);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    alert('Upload failed: ' + error.message);
    return;
  }

  const { data: publicData } = supabase
    .storage
    .from('promo-images')
    .getPublicUrl(data.path);

  if (!publicData?.publicUrl) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    alert('Could not get public URL.');
    return;
  }

  const { error: insertError } = await supabase
    .from('promos')
    .insert([{ image_url: publicData.publicUrl }]);

  if (insertError) {
    console.error('DB insert error:', insertError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    alert('DB insert failed: ' + insertError.message);
    return;
  }

  promoForm.reset();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Upload Promo';
  loadPromos();
});

async function loadPromos() {
  const { data, error } = await supabase
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('promo-container');
  if (error) {
    console.error(error);
    container.innerHTML = '<p>Error loading promos.</p>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>No promos yet.</p>';
    return;
  }

  container.innerHTML = data.map((item) => `
    <div class="promo-card">
      <img src="${escapeHtml(item.image_url)}" alt="Promo" />
      <button class="delete-promo-btn" data-id="${item.id}">Delete Promo</button>
    </div>
  `).join('');
}

document.getElementById('promo-container').addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-promo-btn')) {
    await deletePromo(e.target.dataset.id);
  }
});

async function deletePromo(id) {
  if (!confirm('Delete this promo?')) return;
  const { error } = await supabase
    .from('promos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Failed to delete.');
    return;
  }
  loadPromos();
}

if (await requireAdminSession()) {
  loadProperties();
  loadPromos();
}

