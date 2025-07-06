import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://gxozdkmphuneqglstlyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3pka21waHVuZXFnbHN0bHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTU3MDgsImV4cCI6MjA2Njk5MTcwOH0.OmU29wRbQgZlWIjTVNr50W6dA0B3KtryW1dq0_cgRgs'
);

// Keep admin logged in
localStorage.setItem('isAdmin', 'true');

const propertyForm = document.getElementById('propertyForm');
const promoForm = document.getElementById('promoForm');

propertyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = propertyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const price = document.getElementById('price').value;
  const files = document.getElementById('images').files;

  if (!title || !description || !price || files.length === 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Property';
    return alert('Fill all fields and select at least one image.');
  }

  const imageUrls = [];
  for (let file of files) {
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(`public/${Date.now()}_${file.name}`, file);

    if (error) {
      console.error(error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Property';
      return alert('Image upload failed: ' + error.message);
    }

    const { data: publicData, error: urlError } = supabase
      .storage
      .from('property-images')
      .getPublicUrl(data.path);

    if (urlError || !publicData || !publicData.publicUrl) {
      console.error('Public URL error:', urlError);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Property';
      return alert('Could not get public URL.');
    }

    const publicUrl = publicData.publicUrl;
    imageUrls.push(publicUrl);
  }

  const { error: insertError } = await supabase
    .from('properties')
    .insert([{ title, description, price, images: imageUrls, status: 'Available' }]);

  if (insertError) {
    console.error(insertError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Property';
    return alert('Failed to save property: ' + insertError.message);
  }

  alert('Property saved successfully!');
  propertyForm.reset();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Add Property';
  loadProperties();
});

// Load properties
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

  if (!data || data.length === 0) {
    container.innerHTML = '<p>No properties yet.</p>';
    return;
  }

  container.innerHTML = data.map((item) => `
    <div class="admin-property-card">
      <h3>${item.title}</h3>
      <p>${(item.description || '').replace(/\n/g, '<br>')}</p>
      <p>Status: <strong>${item.status}</strong></p>
      <button class="toggle-status-btn" data-id="${item.id}" data-status="${item.status}">
        Mark as ${item.status === 'Sold' ? 'Available' : 'Sold'}
      </button>
      <button class="delete-property-btn" data-id="${item.id}">Delete</button>
    </div>
  `).join('');
}

// Event delegation for property actions
document.getElementById('properties-container').addEventListener('click', async (e) => {
  if (e.target.classList.contains('toggle-status-btn')) {
    const id = e.target.dataset.id;
    const currentStatus = e.target.dataset.status;
    await toggleStatus(id, currentStatus);
  }
  if (e.target.classList.contains('delete-property-btn')) {
    const id = e.target.dataset.id;
    await deleteProperty(id);
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
    return alert('Failed to update status.');
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
    return alert('Failed to delete.');
  }
  loadProperties();
}

// Promo upload
promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = promoForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  const file = document.getElementById('promoImage').files[0];
  if (!file) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    return alert('Select an image.');
  }

  const { data, error } = await supabase.storage
    .from('promo-images')
    .upload(`public/${Date.now()}_${file.name}`, file);

  if (error) {
    console.error('Upload error:', error);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    return alert('Upload failed: ' + error.message);
  }

  const { data: publicData, error: urlError } = supabase
    .storage
    .from('promo-images')
    .getPublicUrl(data.path);

  if (urlError || !publicData || !publicData.publicUrl) {
    console.error('Public URL error:', urlError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    return alert('Could not get public URL.');
  }

  const publicUrl = publicData.publicUrl;

  const { error: insertError } = await supabase
    .from('promos')
    .insert([{ image_url: publicUrl }]);

  if (insertError) {
    console.error('DB insert error:', insertError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload Promo';
    return alert('DB insert failed: ' + insertError.message);
  }

  alert('Promo uploaded!');
  promoForm.reset();
  submitBtn.disabled = false;
  submitBtn.textContent = 'Upload Promo';
  loadPromos();
});

// Load promos
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
      <img src="${item.image_url}" alt="Promo" />
      <button class="delete-promo-btn" data-id="${item.id}">Delete</button>
    </div>
  `).join('');
}

// Event delegation for promos
document.getElementById('promo-container').addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-promo-btn')) {
    const id = e.target.dataset.id;
    await deletePromo(id);
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
    return alert('Failed to delete.');
  }
  loadPromos();
}

// Initial load
loadProperties();
loadPromos();
