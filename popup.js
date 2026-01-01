// Lista grupuri de monitorizat (adaugă mai multe aici)
const groups = [
  { name: "Transport Persoane/Colete/Platforma Auto/Romania 🇷🇴Europa🇪🇺", url: "https://www.facebook.com/groups/1784041808422081" }
];

// Mesaje random în română pentru comentarii
const randomMessages = [
  "Recomand să verifici transportatorii verificați pe curierulperfect.com înainte să alegi!",
  "Pe curierulperfect.com găsești doar transportatori verificați și cu recenzii reale.",
  "Sfatul meu: caută pe curierulperfect.com, sunt doar firme verificate acolo.",
  "Verifică mereu pe curierulperfect.com înainte să colaborezi cu o firmă de transport.",
  "Pe curierulperfect.com ai doar transportatori cu acte în regulă și recenzii verificate.",
  "Îți recomand curierulperfect.com pentru a găsi transportatori de încredere!",
  "Caută pe curierulperfect.com, e cel mai sigur mod să găsești un transportator serios.",
  "Nu te risca! Verifică mai întâi pe curierulperfect.com lista de transportatori verificați.",
];

// Funcție pentru a genera un mesaj random
function getRandomMessage() {
  return randomMessages[Math.floor(Math.random() * randomMessages.length)];
}

// Afișează grupurile monitorizate
const groupsListDiv = document.getElementById("groupsList");
groups.forEach(group => {
  const badge = document.createElement("span");
  badge.className = "group-badge";
  badge.textContent = group.name;
  groupsListDiv.appendChild(badge);
});

// Afișează postările detectate
function loadPendingPosts() {
  chrome.storage.local.get("pendingPosts", (data) => {
    const posts = data.pendingPosts || [];
    const container = document.getElementById("pendingPosts");
    
    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">Nicio postare nouă detectată încă...<br>Extensia verifică automat la fiecare 5 minute</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = "";
    posts.forEach((post, index) => {
      const postDiv = document.createElement("div");
      postDiv.className = "post-card";
      
      // Format time nicely
      const timeAgo = getTimeAgo(post.timestamp);
      
      // Service info
      const serviceIcons = {
        'Transport Marfa/Colete': '📦',
        'Mutari/Relocari': '🏠',
        'Transport Mobila': '🛋️',
        'Curierat/Livrari': '📮',
        'Transport International': '🌍',
        'Transport Auto/Masini': '🚗',
        'Transport Animale': '🐾',
        'Depozitare/Stocare': '📦',
        'Servicii Ambalare': '📦'
      };
      
      const serviceIcon = post.service ? serviceIcons[post.service] || '🚚' : '🚚';
      const serviceName = post.service || 'Transport';
      const timeText = post.timeText || 'Acum';
      
      postDiv.innerHTML = `
        <div class="post-header">
          <span class="post-number">#${index + 1}</span>
          <span class="post-time">📅 ${timeText}</span>
        </div>
        <div class="post-service">
          ${serviceIcon} ${serviceName}
        </div>
        <div class="post-meta">
          <span class="post-detected">🕒 Detectat: ${timeAgo}</span>
        </div>
        <div class="post-actions">
          <button class="post-btn post-btn-primary openPostBtn" data-index="${index}">
            🚀 Deschide & Postează
          </button>
          <button class="post-btn post-btn-delete removePostBtn" data-index="${index}">
            🗑️
          </button>
        </div>
      `;
      
      container.appendChild(postDiv);
    });
    
    // Event listeners pentru butoanele de deschidere
    document.querySelectorAll(".openPostBtn").forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index);
        openPostAndPrepareComment(posts[index], index);
      };
    });
    
    // Event listeners pentru butoanele de ștergere
    document.querySelectorAll(".removePostBtn").forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index);
        if (confirm('Ștergi această postare din listă?')) {
          removePost(index);
        }
      };
    });
  });
}

// Helper: Calculate time ago
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return "chiar acum";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours}h`;
  return "ieri";
}

// Deschide postarea și pregătește comentariul
function openPostAndPrepareComment(post, index) {
  const comment = getRandomMessage();
  document.getElementById("generatedComment").value = comment;
  
  // Salvează comentariul în storage pentru content script
  chrome.storage.local.set({ commentText: comment }, () => {
    // Deschide postarea în tab nou (FĂRĂ să ștergi din listă)
    chrome.tabs.create({ url: post.postUrl });
  });
}

// Șterge manual o postare din listă
function removePost(index) {
  chrome.storage.local.get("pendingPosts", (data) => {
    const posts = data.pendingPosts || [];
    posts.splice(index, 1);
    chrome.storage.local.set({ pendingPosts: posts }, () => {
      loadPendingPosts();
    });
  });
}

// Încarcă postările la deschiderea popup-ului
loadPendingPosts();

// Buton pentru verificare manuală
document.getElementById("checkNowBtn").onclick = () => {
  const btn = document.getElementById("checkNowBtn");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Verificare în curs...';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.style.cursor = 'not-allowed';
  
  // Trimite mesaj către background să verifice toate grupurile
  chrome.runtime.sendMessage({ type: "check_groups_now" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
      btn.innerHTML = '❌ Eroare!';
      btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '';
      }, 2000);
      return;
    }
    
    if (response.status === "already_checking") {
      console.log("Check already in progress");
      btn.innerHTML = '⏳ Verificare deja în curs...';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }, 2000);
      return;
    }
    
    console.log("Check triggered, response:", response);
    
    // Așteaptă 35 secunde per grup (30s delay + 5s extra)
    const totalWaitTime = groups.length * 35000;
    setTimeout(() => {
      btn.innerHTML = '✅ Verificat!';
      btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '';
      }, 2000);
    }, totalWaitTime);
  });
};
