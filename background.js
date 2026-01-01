// Curierul Perfect - Background Service Worker
console.log("Background worker started!");

const groups = [
  { name: "Transport Persoane/Colete/Platforma", url: "https://www.facebook.com/groups/1784041808422081" }
];

let seenPostIds = new Set();
let isChecking = false;

// Încarcă posturile văzute
chrome.storage.local.get(["seenPostIds", "pendingPosts"], (data) => {
  if (data.seenPostIds) {
    seenPostIds = new Set(data.seenPostIds);
    console.log("Loaded", seenPostIds.size, "seen post IDs");
  }
});

// Crează alarm pentru verificare periodică
chrome.alarms.create("checkGroups", { periodInMinutes: 5 });
console.log("Alarm created: every 5 minutes");

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkGroups" && !isChecking) {
    console.log("Alarm triggered, checking groups...");
    checkAllGroups();
  }
});

// Verificare manuală din popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check_groups_now") {
    console.log("Manual check requested");
    if (!isChecking) {
      checkAllGroups();
      sendResponse({ status: "started" });
    } else {
      sendResponse({ status: "already_checking" });
    }
    return true;
  }
  
  if (message.type === "posts_from_scan") {
    console.log("Received posts from scan:", message.posts.length);
    processPosts(message.posts, message.groupName);
    sendResponse({ status: "received" });
    return true;
  }
});

async function checkAllGroups() {
  isChecking = true;
  console.log("Starting group check...");
  
  for (const group of groups) {
    console.log("Checking group:", group.name);
    await checkGroup(group);
    await sleep(5000); // 5s între grupuri
  }
  
  isChecking = false;
  console.log("All groups checked!");
}

async function checkGroup(group) {
  return new Promise((resolve) => {
    console.log("Opening tab for:", group.url);
    
    chrome.tabs.create({ url: group.url, active: false }, (tab) => {
      const tabId = tab.id;
      console.log("Tab created:", tabId);
      
      // Așteaptă să se încarce pagina
      setTimeout(() => {
        console.log("Sending scan command to tab", tabId);
        
        chrome.tabs.sendMessage(tabId, {
          type: "scan_for_posts",
          groupName: group.name
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error sending message:", chrome.runtime.lastError.message);
          } else if (response && response.posts) {
            console.log("Received", response.posts.length, "posts from scan");
            processPosts(response.posts, group.name);
          }
          
          // Închide tab-ul
          setTimeout(() => {
            chrome.tabs.remove(tabId, () => {
              console.log("Tab closed:", tabId);
              resolve();
            });
          }, 2000);
        });
      }, 10000); // 10s pentru încărcare pagină + scroll
    });
  });
}

function processPosts(posts, groupName) {
  if (!posts || posts.length === 0) {
    console.log("No posts to process from", groupName);
    return;
  }
  
  // Filtrează posturile noi
  const newPosts = posts.filter(post => !seenPostIds.has(post.postId));
  console.log("New posts:", newPosts.length, "out of", posts.length);
  
  if (newPosts.length === 0) return;
  
  // Marchează ca văzute
  newPosts.forEach(post => seenPostIds.add(post.postId));
  chrome.storage.local.set({ seenPostIds: Array.from(seenPostIds) });
  
  // Adaugă la pending
  chrome.storage.local.get("pendingPosts", (data) => {
    const pending = data.pendingPosts || [];
    const updated = [...newPosts, ...pending].slice(0, 50); // max 50 posturi
    chrome.storage.local.set({ pendingPosts: updated });
    
    console.log("Added", newPosts.length, "posts. Total pending:", updated.length);
    
    // Notificare
    if (newPosts.length > 0) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Postări noi găsite!",
        message: newPosts.length + " postări noi cu \"caut\" în " + groupName
      });
    }
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
