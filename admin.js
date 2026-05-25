import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const propertyForm = document.getElementById('propertyForm');
const promoForm = document.getElementById('promoForm');
const logoutBtn = document.getElementById('logoutBtn');

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  });
}

async function requireAdminSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    window.location.href = '/';
    return false;
  }

  const { data, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .single();

  if (adminError || !data) {
    await supabase.auth.signOut();
    window.location.href = '/';
    return false;
  }

  return true;
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

  if (!title || !location || !description || !price || files.length === 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Property';
    alert('Fill all fields and select at least one image.');
    return;
  }

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
      submitBtn.textContent = 'Publish Property';
      alert('Image upload failed: ' + error.message);
      return;
    }

    const { data: publicData } = supabase
      .storage
      .from('property-images')
      .getPublicUrl(data.path);

    if (!publicData?.publicUrl) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Property';
      alert('Could not get public URL.');
      return;
    }

    media.push({
      url: publicData.publicUrl,
      type: isVideo ? 'video' : 'image',
    });
    if (!isVideo) imageUrls.push(publicData.publicUrl);
  }

  const { error: insertError } = await supabase
    .from('properties')
    .insert([{
      title,
      location,
      category,
      bedrooms: bedrooms ? Number(bedrooms) : null,
      bathrooms: bathrooms ? Number(bathrooms) : null,
      description,
      price,
      images: imageUrls,
      media,
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
  const availableEl = document.getElementById('availableProperties');
  const soldEl = document.getElementById('soldProperties');
  if (totalEl && availableEl && soldEl) {
    totalEl.textContent = String(data?.length || 0);
    availableEl.textContent = String((data || []).filter((item) => item.status !== 'Sold').length);
    soldEl.textContent = String((data || []).filter((item) => item.status === 'Sold').length);
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>No properties yet.</p>';
    return;
  }

  container.innerHTML = data.map((item) => `
    <article class="admin-property-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.location || 'Location not set')}</p>
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

