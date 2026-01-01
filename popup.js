// Popup.js - Curierul Perfect
const GROUP = { 
  name: "Transport Persoane/Colete/Platforma", 
  url: "https://www.facebook.com/groups/1784041808422081" 
};

const messages = [
  "Recomand curierulperfect.com pentru transportatori verificati!",
  "Gasesti transportatori de incredere pe curierulperfect.com",
  "Verifica pe curierulperfect.com inainte sa alegi!",
  "Pe curierulperfect.com sunt doar firme verificate."
];

// Init
document.getElementById("groupsList").innerHTML = 
  `<span class="group-badge">${GROUP.name}</span>`;

document.getElementById("comment").value = 
  messages[Math.floor(Math.random() * messages.length)];

loadPosts();

// Check button
document.getElementById("checkBtn").onclick = () => {
  const btn = document.getElementById("checkBtn");
  btn.textContent = "Se verifica...";
  btn.disabled = true;
  
  chrome.runtime.sendMessage({ type: "check_groups_now" }, (r) => {
    console.log("Check response:", r);
    setTimeout(() => {
      btn.textContent = "Verifica Acum";
      btn.disabled = false;
      loadPosts();
    }, 15000);
  });
};

// Load posts from storage
function loadPosts() {
  chrome.storage.local.get("pendingPosts", (data) => {
    const posts = data.pendingPosts || [];
    const container = document.getElementById("posts");
    
    if (posts.length === 0) {
      container.innerHTML = `<div class="empty">Nicio postare detectata<br>Apasa "Verifica Acum"</div>`;
      return;
    }
    
    container.innerHTML = posts.map((post, i) => `
      <div class="post-item">
        <div class="post-header">
          <span>#${i+1} - ${post.timeText || "recent"}</span>
          <span class="post-keyword">${post.keyword}</span>
        </div>
        <div class="post-text">${truncate(post.postText, 80)}</div>
        <div class="post-actions">
          <button class="btn-open" data-url="${post.postUrl}">Deschide</button>
          <button class="btn-delete" data-idx="${i}">X</button>
        </div>
      </div>
    `).join("");
    
    // Open buttons
    container.querySelectorAll(".btn-open").forEach(btn => {
      btn.onclick = () => {
        const url = btn.dataset.url;
        const comment = document.getElementById("comment").value;
        
        chrome.tabs.create({ url: url }, (tab) => {
          // Wait and type comment
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { 
              type: "type_comment", 
              text: comment 
            });
          }, 3000);
        });
      };
    });
    
    // Delete buttons
    container.querySelectorAll(".btn-delete").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        posts.splice(idx, 1);
        chrome.storage.local.set({ pendingPosts: posts });
        loadPosts();
      };
    });
  });
}

function truncate(str, len) {
  if (!str) return "...";
  return str.length > len ? str.substring(0, len) + "..." : str;
}
