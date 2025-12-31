// Lista grupuri de monitorizat (adaugă mai multe aici)
const groups = [
  { name: "Grup 1", url: "https://www.facebook.com/groups/1784041808422081" },
  { name: "Grup 2", url: "https://www.facebook.com/groups/1854136051495911" },
  { name: "Grup 3", url: "https://www.facebook.com/groups/2812445122109133" }
];

// Mesaje random în română pentru comentarii
const randomMessages = [
  "Recomand să verifici transportatorii verificați pe curierulperfect.ro înainte să alegi!",
  "Pe curierulperfect.ro găsești doar transportatori verificați și cu recenzii reale.",
  "Sfatul meu: caută pe curierulperfect.ro, sunt doar firme verificate acolo.",
  "Verifică mereu pe curierulperfect.ro înainte să colaborezi cu o firmă de transport.",
  "Pe curierulperfect.ro ai doar transportatori cu acte în regulă și recenzii verificate.",
  "Îți recomand curierulperfect.ro pentru a găsi transportatori de încredere!",
  "Caută pe curierulperfect.ro, e cel mai sigur mod să găsești un transportator serios.",
  "Nu te risca! Verifică mai întâi pe curierulperfect.ro lista de transportatori verificați.",
];

// Funcție pentru a genera un mesaj random
function getRandomMessage() {
  return randomMessages[Math.floor(Math.random() * randomMessages.length)];
}

// Afișează grupurile monitorizate
const groupsListDiv = document.getElementById("groupsList");
groups.forEach(group => {
  const item = document.createElement("div");
  item.innerHTML = `✅ <strong>${group.name}</strong>`;
  item.style.marginBottom = "5px";
  groupsListDiv.appendChild(item);
});

// Afișează postările detectate
function loadPendingPosts() {
  chrome.storage.local.get("pendingPosts", (data) => {
    const posts = data.pendingPosts || [];
    const container = document.getElementById("pendingPosts");
    
    if (posts.length === 0) {
      container.innerHTML = '<p style="color: #999;">Nicio postare nouă detectată încă...</p>';
      return;
    }
    
    container.innerHTML = "";
    posts.forEach((post, index) => {
      const postDiv = document.createElement("div");
      postDiv.style.marginBottom = "10px";
      postDiv.style.padding = "10px";
      postDiv.style.border = "1px solid #ddd";
      postDiv.style.borderRadius = "5px";
      
      postDiv.innerHTML = `
        <strong>${post.groupName}</strong><br>
        <small style="color: #666;">Detectat: ${new Date(post.timestamp).toLocaleString('ro-RO')}</small><br>
        <button class="openPostBtn" data-index="${index}">🚀 Deschide & Postează</button>
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
  });
}

// Deschide postarea și pregătește comentariul
function openPostAndPrepareComment(post, index) {
  const comment = getRandomMessage();
  document.getElementById("generatedComment").value = comment;
  
  // Salvează comentariul în storage pentru content script
  chrome.storage.local.set({ commentText: comment }, () => {
    // Deschide postarea în tab nou
    chrome.tabs.create({ url: post.postUrl }, () => {
      // Șterge postarea din listă după ce e deschisă
      chrome.storage.local.get("pendingPosts", (data) => {
        const posts = data.pendingPosts || [];
        posts.splice(index, 1);
        chrome.storage.local.set({ pendingPosts: posts }, () => {
          loadPendingPosts();
        });
      });
    });
  });
}

// Încarcă postările la deschiderea popup-ului
loadPendingPosts();

// Reîncarcă lista la fiecare 2 secunde (pentru actualizări)
setInterval(loadPendingPosts, 2000);
