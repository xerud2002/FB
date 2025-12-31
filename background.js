// Lista grupuri de monitorizat (sincronizată cu popup.js)
const groups = [
  { name: "MXC", url: "https://www.facebook.com/groups/179512120723134" },
  { name: "Oferte Transport Europa", url: "https://www.facebook.com/groups/transport.europe" },
  { name: "Transport Marfa Romania", url: "https://www.facebook.com/groups/transportmarfaromania" },
  // Adaugă mai multe grupuri aici
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
chrome.runtime.onMessage.addListener((message, sender) => {
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
