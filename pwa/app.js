// PWA App Logic
let deferredPrompt;
let posts = [];

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then((reg) => console.log('✅ Service Worker registered', reg))
    .catch((err) => console.error('❌ SW registration failed', err));
}

// Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installPrompt').classList.add('show');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Install outcome: ${outcome}`);
  
  deferredPrompt = null;
  document.getElementById('installPrompt').classList.remove('show');
});

// Enable Notifications
document.getElementById('enableNotifications').addEventListener('click', async () => {
  if (!('Notification' in window)) {
    showStatus('error', 'Browser-ul nu suportă notificări');
    return;
  }
  
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    showStatus('success', '✅ Notificări activate!');
    document.getElementById('notificationStatus').textContent = '✅ Notificări active';
    document.getElementById('notificationStatus').className = 'status success';
    
    // Subscribe to push (disabled for now - needs HTTPS)
    // subscribeToPush();
  } else {
    showStatus('error', '❌ Notificări refuzate');
  }
});

// Subscribe to Push Notifications
async function subscribeToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Înlocuiește cu cheia ta VAPID
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BJONp8h8U6zQVnCrB3kEih2F5gcys7hpCEai7FPrT1ik9cin_BXZmajFy-lhYYKDSBYZHiT1RUvwkOToc8HT6-w')
    });
    
    // Trimite subscription la server
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    console.log('✅ Subscribed to push notifications');
  } catch (err) {
    console.error('❌ Push subscription failed:', err);
  }
}

// Refresh Posts
document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  const originalHTML = btn.innerHTML;
  
  btn.innerHTML = '<div class="spinner"></div><span>Verificare...</span>';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/posts');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    posts = data.posts || [];
    renderPosts();
    
    showStatus('success', `✅ ${posts.length} postări găsite`);
  } catch (err) {
    showStatus('error', '❌ Eroare la verificare: ' + err.message);
    console.error('Fetch error:', err);
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
});

// Clear Cache
document.getElementById('clearCacheBtn').addEventListener('click', async () => {
  if (confirm('Ștergi cache-ul și postările salvate?')) {
    posts = [];
    localStorage.clear();
    
    // Clear Service Worker cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    renderPosts();
    showStatus('success', '✅ Cache șters!');
  }
});

// Render Posts
function renderPosts() {
  const container = document.getElementById('postsList');
  const countEl = document.getElementById('postCount');
  
  countEl.textContent = posts.length;
  
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>Nicio postare detectată încă</p>
        <p style="font-size: 12px; margin-top: 8px;">Click "Verifică Postări Noi"</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = posts.map((post, index) => `
    <div class="post-item">
      <div class="time">⏱️ ${post.timeText || 'Acum'}</div>
      <div class="service">${post.service || 'Transport'}</div>
      <div class="actions">
        <button class="open-btn" onclick="openPost('${post.postUrl}')">
          🚀 Deschide
        </button>
        <button class="delete-btn" onclick="deletePost(${index})">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
  
  // Save to localStorage
  localStorage.setItem('posts', JSON.stringify(posts));
}

// Open Post
function openPost(url) {
  window.open(url, '_blank');
}

// Delete Post
function deletePost(index) {
  if (confirm('Ștergi această postare din listă?')) {
    posts.splice(index, 1);
    renderPosts();
  }
}

// Show Status Message
function showStatus(type, message) {
  const status = document.createElement('div');
  status.className = `status ${type}`;
  status.textContent = message;
  status.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; min-width: 300px;';
  
  document.body.appendChild(status);
  
  setTimeout(() => {
    status.style.animation = 'slideDown 0.3s ease reverse';
    setTimeout(() => status.remove(), 300);
  }, 3000);
}

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Load posts on startup
window.addEventListener('load', () => {
  const saved = localStorage.getItem('posts');
  if (saved) {
    posts = JSON.parse(saved);
    renderPosts();
  }
});
