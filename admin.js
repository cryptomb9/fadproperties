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
const inventorySearch = document.getElementById('inventorySearch');
const clearInventorySearch = document.getElementById('clearInventorySearch');
const editListingModal = document.getElementById('editListingModal');
const closeEditModal = document.getElementById('closeEditModal');
const editListingForm = document.getElementById('editListingForm');
const editMessage = document.getElementById('edit-message');

let allInventory = [];
let inventoryFilter = 'all';
let inventoryQuery = '';

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

function listingUrl(id) {
  return `${window.location.origin}/property?id=${encodeURIComponent(id)}`;
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

  allInventory = data || [];
  renderInventory();
}

function updateInventoryStats(items) {
  const totalListingsEl = document.getElementById('totalListings');
  const totalEl = document.getElementById('totalProperties');
  const landsEl = document.getElementById('totalLands');
  const availableEl = document.getElementById('availableProperties');
  const soldEl = document.getElementById('soldProperties');
  if (totalListingsEl && totalEl && landsEl && availableEl && soldEl) {
    totalListingsEl.textContent = String(items.length);
    totalEl.textContent = String(items.filter((item) => listingType(item) !== 'land').length);
    landsEl.textContent = String(items.filter((item) => listingType(item) === 'land').length);
    availableEl.textContent = String(items.filter((item) => item.status !== 'Sold').length);
    soldEl.textContent = String(items.filter((item) => item.status === 'Sold').length);
  }
}

function filteredInventory() {
  const query = inventoryQuery.toLowerCase().trim();
  return allInventory.filter((item) => {
    const type = listingType(item);
    const status = item.status === 'Sold' ? 'sold' : 'available';
    const filterMatch = inventoryFilter === 'all'
      || inventoryFilter === type
      || inventoryFilter === status;
    const text = [
      item.id,
      item.title,
      item.location,
      item.category,
      item.size,
      item.description,
      item.price,
      item.status,
    ].filter(Boolean).join(' ').toLowerCase();

    return filterMatch && (!query || text.includes(query));
  });
}

function renderInventory() {
  const container = document.getElementById('properties-container');
  if (!container) return;

  updateInventoryStats(allInventory);

  const items = filteredInventory();
  if (!items.length) {
    container.innerHTML = '<p>No matching listings.</p>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="admin-property-card">
      <div class="admin-card-head">
        <h3>${escapeHtml(item.title)}</h3>
        <span>${escapeHtml(item.id)}</span>
      </div>
      <p>${escapeHtml(listingType(item) === 'land' ? 'Land' : 'Property')} / ${escapeHtml(item.location || 'Location not set')}</p>
      <p>${escapeHtml([item.category, item.size].filter(Boolean).join(' / ') || 'Category not set')}</p>
      <p>${escapeHtml(item.description || '').slice(0, 170)}${(item.description || '').length > 170 ? '...' : ''}</p>
      <p>Price: <strong>${escapeHtml(item.price || 'Not set')}</strong></p>
      <p>Status: <strong>${escapeHtml(item.status || 'Available')}</strong></p>
      <div class="admin-actions">
        <button class="copy-id-btn" data-id="${item.id}">Copy ID</button>
        <button class="copy-link-btn" data-id="${item.id}">Copy Link</button>
        <button class="edit-property-btn" data-id="${item.id}">Edit</button>
        <button class="toggle-status-btn" data-id="${item.id}" data-status="${escapeHtml(item.status || 'Available')}">
          Mark as ${item.status === 'Sold' ? 'Available' : 'Sold'}
        </button>
        <button class="delete-property-btn" data-id="${item.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

document.getElementById('properties-container').addEventListener('click', async (e) => {
  if (e.target.classList.contains('copy-id-btn')) {
    await copyText(e.target.dataset.id);
    e.target.textContent = 'Copied';
    window.setTimeout(() => (e.target.textContent = 'Copy ID'), 1200);
  }
  if (e.target.classList.contains('copy-link-btn')) {
    await copyText(listingUrl(e.target.dataset.id));
    e.target.textContent = 'Copied';
    window.setTimeout(() => (e.target.textContent = 'Copy Link'), 1200);
  }
  if (e.target.classList.contains('edit-property-btn')) {
    openEditModal(e.target.dataset.id);
  }
  if (e.target.classList.contains('toggle-status-btn')) {
    await toggleStatus(e.target.dataset.id, e.target.dataset.status);
  }
  if (e.target.classList.contains('delete-property-btn')) {
    await deleteProperty(e.target.dataset.id);
  }
});

document.querySelectorAll('[data-inventory-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    inventoryFilter = button.dataset.inventoryFilter;
    document.querySelectorAll('[data-inventory-filter]').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    renderInventory();
  });
});

if (inventorySearch) {
  inventorySearch.addEventListener('input', (event) => {
    inventoryQuery = event.target.value;
    renderInventory();
  });
}

if (clearInventorySearch) {
  clearInventorySearch.addEventListener('click', () => {
    inventoryQuery = '';
    if (inventorySearch) inventorySearch.value = '';
    renderInventory();
  });
}

if (closeEditModal && editListingModal) {
  closeEditModal.addEventListener('click', () => {
    editListingModal.style.display = 'none';
  });
}

if (editListingModal) {
  editListingModal.addEventListener('click', (event) => {
    if (event.target === editListingModal) editListingModal.style.display = 'none';
  });
}

function openEditModal(id) {
  const item = allInventory.find((entry) => entry.id === id);
  if (!item || !editListingModal) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('editListingType').value = listingType(item);
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editLocation').value = item.location || '';
  document.getElementById('editCategory').value = item.category || '';
  document.getElementById('editSize').value = item.size || '';
  document.getElementById('editBedrooms').value = item.bedrooms ?? '';
  document.getElementById('editBathrooms').value = item.bathrooms ?? '';
  document.getElementById('editDescription').value = item.description || '';
  document.getElementById('editPrice').value = item.price || '';
  document.getElementById('editStatus').value = item.status === 'Sold' ? 'Sold' : 'Available';
  document.getElementById('editMediaMode').value = 'keep';
  document.getElementById('editMedia').value = '';
  if (editMessage) editMessage.style.display = 'none';
  editListingModal.style.display = 'flex';
}

if (editListingForm) {
  editListingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = editListingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const listing_type = document.getElementById('editListingType').value;
    const bedroomsRaw = document.getElementById('editBedrooms').value;
    const bathroomsRaw = document.getElementById('editBathrooms').value;
    const payload = {
      listing_type,
      title: document.getElementById('editTitle').value.trim(),
      location: document.getElementById('editLocation').value.trim(),
      category: document.getElementById('editCategory').value.trim(),
      size: document.getElementById('editSize').value.trim(),
      bedrooms: listing_type === 'land' ? null : (bedroomsRaw ? Number(bedroomsRaw) : null),
      bathrooms: listing_type === 'land' ? null : (bathroomsRaw ? Number(bathroomsRaw) : null),
      description: document.getElementById('editDescription').value.trim(),
      price: document.getElementById('editPrice').value.trim(),
      status: document.getElementById('editStatus').value,
    };

    const id = document.getElementById('editId').value;
    const currentItem = allInventory.find((entry) => entry.id === id);
    const mediaMode = document.getElementById('editMediaMode').value;
    const files = document.getElementById('editMedia').files;

    if (files.length > 0 && mediaMode !== 'keep') {
      try {
        const uploaded = await uploadMediaFiles(files, submitBtn, 'Save Changes');
        if (mediaMode === 'replace') {
          payload.media = uploaded.media;
          payload.images = uploaded.imageUrls;
        } else {
          const existingMedia = Array.isArray(currentItem?.media) ? currentItem.media : [];
          const existingImages = Array.isArray(currentItem?.images) ? currentItem.images : [];
          payload.media = [...existingMedia, ...uploaded.media];
          payload.images = [...existingImages, ...uploaded.imageUrls];
        }
      } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
        if (editMessage) {
          editMessage.textContent = error.message;
          editMessage.style.display = 'block';
        }
        return;
      }
    }

    const { error } = await supabase
      .from('properties')
      .update(payload)
      .eq('id', id);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';

    if (error) {
      console.error(error);
      if (editMessage) {
        editMessage.textContent = 'Failed to save changes.';
        editMessage.style.display = 'block';
      }
      return;
    }

    editListingModal.style.display = 'none';
    loadProperties();
  });
}

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

