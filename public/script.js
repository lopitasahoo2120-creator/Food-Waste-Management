// ---------- Helpers ----------
const $ = id => document.getElementById(id);
let user = JSON.parse(localStorage.getItem('foodshareUser') || 'null');

// Escape text so user input cannot inject HTML
function esc(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : t;
  return d.innerHTML;
}

function showMessage(text, type) {
  $('message').textContent = text;
  $('message').className = type || '';
}

// Small wrapper around fetch: sends JSON, throws an Error with the server's message
async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- Dashboard stats ----------
async function loadStats() {
  const s = await api('/api/stats');
  $('sMeals').textContent = s.meals_saved;
  $('sAvail').textContent = s.available;
  $('sWasted').textContent = s.wasted;
  $('sDonors').textContent = s.donors;
}

// ---------- Show the right page ----------
function render() {
  $('authSection').hidden = !!user;
  $('userBox').hidden = !user;
  $('donorSection').hidden = !(user && user.role === 'donor');
  $('receiverSection').hidden = !(user && user.role === 'receiver');
  if (user) {
    $('userInfo').textContent = `${user.name} (${user.role}) - ID: ${user.id}`;
    loadFood();
  }
  loadStats();
}

// ---------- Food cards ----------
function card(f, buttons) {
  const when = new Date(f.expiry_time).toLocaleString();
  return `
    <div class="card">
      <span class="badge ${f.status}">${f.status}</span>
      <h3>${esc(f.title)}</h3>
      <p>🍽 Quantity: ${f.quantity} meals</p>
      <p>📍 ${esc(f.location)}</p>
      <p>⏰ Expires: ${when}</p>
      <p>🏢 Donor: ${esc(f.donor_name)} ${f.donor_phone ? '(' + esc(f.donor_phone) + ')' : ''}</p>
      ${f.receiver_name ? `<p>🤝 Claimed by: ${esc(f.receiver_name)}</p>` : ''}
      <div class="actions">${buttons || ''}</div>
    </div>`;
}

function fillList(id, items, makeButtons, emptyText) {
  $(id).innerHTML = items.length
    ? items.map(f => card(f, makeButtons(f))).join('')
    : `<p class="empty">${emptyText}</p>`;
}

async function loadFood() {
  const all = await api('/api/food');

  if (user.role === 'donor') {
    const mine = all.filter(f => f.donor_id === user.id);
    fillList('donorList', mine,
      f => f.status === 'available' ? `<button class="red" data-act="delete" data-id="${f.id}">Delete</button>` : '',
      'You have not posted any food yet.');
  } else {
    const available = all.filter(f => f.status === 'available');
    const claims = all.filter(f => f.claimed_by === user.id);
    fillList('availableList', available,
      f => `<button data-act="claim" data-id="${f.id}">Claim</button>`,
      'No food available right now. Check again soon!');
    fillList('claimList', claims,
      f => f.status === 'claimed' ? `<button class="blue" data-act="collect" data-id="${f.id}">Mark Collected</button>` : '',
      'You have not claimed any food yet.');
  }
}

// ---------- Actions (claim / collect / delete) ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  try {
    if (btn.dataset.act === 'claim') {
      await api(`/api/food/${id}/claim`, 'PATCH', { receiver_id: user.id });
      showMessage('Food claimed! Please collect it before it expires.', 'ok');
    } else if (btn.dataset.act === 'collect') {
      await api(`/api/food/${id}/collect`, 'PATCH');
      showMessage('Marked as collected. Thank you for saving food!', 'ok');
    } else if (btn.dataset.act === 'delete') {
      if (!confirm('Delete this listing?')) return;
      await api(`/api/food/${id}?donor_id=${user.id}`, 'DELETE');
      showMessage('Listing deleted.', 'ok');
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
  render();
});

// ---------- Register ----------
$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    user = await api('/api/users', 'POST', {
      name: $('regName').value,
      role: $('regRole').value,
      phone: $('regPhone').value
    });
    localStorage.setItem('foodshareUser', JSON.stringify(user));
    showMessage(`Registered! Your User ID is ${user.id}. Remember it to login later.`, 'ok');
    render();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

// ---------- Login ----------
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    user = await api('/api/users/' + $('loginId').value);
    localStorage.setItem('foodshareUser', JSON.stringify(user));
    showMessage('Welcome back, ' + user.name + '!', 'ok');
    render();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

// ---------- Logout ----------
$('logoutBtn').addEventListener('click', () => {
  user = null;
  localStorage.removeItem('foodshareUser');
  showMessage('');
  render();
});

// ---------- Donor posts food ----------
$('foodForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/food', 'POST', {
      donor_id: user.id,
      title: $('fTitle').value,
      quantity: parseInt($('fQty').value, 10),
      location: $('fLocation').value,
      expiry_time: $('fExpiry').value
    });
    $('foodForm').reset();
    showMessage('Food posted successfully!', 'ok');
    render();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

// ---------- Start ----------
render();
setInterval(() => { if (user) loadFood(); loadStats(); }, 30000); // auto refresh every 30 seconds
