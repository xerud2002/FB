// Lista grupuri de monitorizat (sincronizată cu popup.js)
const groups = [
  { name: "Grup 1", url: "https://www.facebook.com/groups/1784041808422081" },
  { name: "Grup 2", url: "https://www.facebook.com/groups/1854136051495911" },
  { name: "Grup 3", url: "https://www.facebook.com/groups/2812445122109133" }
];

// Tracking pentru ultimul post din fiecare grup
let lastPostIds = {};

// Crează alarm pentru verificare periodică
chrome.alarms.create("checkGroups", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkGroups") {
    // Verifică toate grupurile, unul după altul
    groups.forEach((group, index) => {
      setTimeout(() => {
        checkGroup(group);
      }, index * 5000); // 5 secunde între fiecare grup pentru a nu supraîncărca
    });
  }
});

function checkGroup(group) {
  chrome.tabs.create({ url: group.url, active: false }, (tab) => {
    const tabId = tab.id;

    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["checkForNewPost.js"]
      }).then(() => {
        // Trimite numele grupului către script
        chrome.tabs.sendMessage(tabId, { 
          type: "group_info", 
          groupName: group.name 
        });
      });
    }, 2000);

    setTimeout(() => chrome.tabs.remove(tabId), 15000);
  });
}

// Ascultă mesaje despre postări noi
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verificare manuală din popup
  if (message.type === "check_groups_now") {
    console.log("Manual check triggered!");
    groups.forEach((group, index) => {
      setTimeout(() => {
        checkGroup(group);
      }, index * 5000);
    });
    sendResponse({ status: "checking" });
    return true;
  }
  
  if (message.type === "new_post_detected") {
    const groupKey = message.groupName || "unknown";
    
    // Verifică dacă e un post nou
    if (message.postId !== lastPostIds[groupKey]) {
      lastPostIds[groupKey] = message.postId;
      
      // Adaugă postarea în lista de pending
      chrome.storage.local.get("pendingPosts", (data) => {
        const posts = data.pendingPosts || [];
        
        posts.push({
          groupName: message.groupName,
          postId: message.postId,
          postUrl: message.postUrl,
          timestamp: Date.now()
        });
        
        chrome.storage.local.set({ pendingPosts: posts }, () => {
          // Notificare desktop
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "Postare nouă detectată!",
            message: `Grup: ${message.groupName}\nClick pentru a răspunde!`,
            priority: 2
          });
        });
      });
    }
  }
});

console.log("Curierul Perfect Assistant - Background worker started!");
