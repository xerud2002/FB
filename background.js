// Lista grupuri de monitorizat (sincronizată cu popup.js)
const groups = [
  { name: "Transport Persoane/Colete/Platforma Auto/Romania 🇷🇴Europa🇪🇺", url: "https://www.facebook.com/groups/1784041808422081" },
  { name: "CAUT PLATFORMA", url: "https://www.facebook.com/groups/1972463676346910" }
];

// Tracking pentru toate post ID-urile văzute vreodată
let seenPostIds = new Set();

// Încarcă post ID-urile văzute la pornirea extensiei
chrome.storage.local.get("seenPostIds", (data) => {
  if (data.seenPostIds) {
    seenPostIds = new Set(data.seenPostIds);
    console.log(`Loaded ${seenPostIds.size} previously seen post IDs`);
  }
});

// Salvează periodic post ID-urile văzute
function saveSeenPostIds() {
  chrome.storage.local.set({ seenPostIds: Array.from(seenPostIds) });
}

// Flag pentru a preveni verificări simultane
let isChecking = false;

// Crează alarm pentru verificare periodică - șterge alarma existentă mai întâi
chrome.alarms.clear("checkGroups", (wasCleared) => {
  console.log(`Previous alarm cleared: ${wasCleared}`);
  chrome.alarms.create("checkGroups", { periodInMinutes: 5 });
  console.log("Alarm created: checkGroups every 5 minutes");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkGroups") {
    if (isChecking) {
      console.log("⚠️ Already checking groups, skipping this alarm...");
      return;
    }
    
    isChecking = true;
    console.log("🔔 Alarm triggered: Starting group check...");
    
    // Verifică toate grupurile, unul după altul
    groups.forEach((group, index) => {
      setTimeout(() => {
        checkGroup(group);
      }, index * 30000); // 30 secunde între fiecare grup pentru a nu supraîncărca
    });
    
    // Reset flag după ce toate grupurile au fost verificate
    setTimeout(() => {
      isChecking = false;
      console.log("✅ All groups checked, ready for next alarm");
    }, groups.length * 30000 + 5000);
  }
});

function checkGroup(group) {
  console.log(`[checkGroup] Starting check for: ${group.name}`);
  console.log(`[checkGroup] URL: ${group.url}`);
  
  // Creează tab în background (complet ascuns)
  chrome.tabs.create({ 
    url: group.url, 
    active: false,
    // Mută tab-ul într-o fereastră minimizată dacă e posibil
  }, (tab) => {
    const tabId = tab.id;
    console.log(`[checkGroup] Tab created with ID: ${tabId} (hidden)`);

    setTimeout(() => {
      console.log(`[checkGroup] Attempting to inject script in tab ${tabId}...`);
      
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["checkForNewPost.js"]
      }).then(() => {
        console.log(`[checkGroup] ✅ Script injected successfully in tab ${tabId}`);
        
        // Așteaptă 500ms înainte de a trimite mesajul
        setTimeout(() => {
          console.log(`[checkGroup] Sending group info to tab ${tabId}...`);
          chrome.tabs.sendMessage(tabId, { 
            type: "group_info", 
            groupName: group.name 
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error(`[checkGroup] ❌ Could not send message to tab ${tabId}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`[checkGroup] ✅ Message sent to tab ${tabId}, response:`, response);
            }
          });
        }, 500);
      }).catch(err => {
        console.error(`[checkGroup] ❌ Failed to inject script in tab ${tabId}:`, err);
      });
    }, 2000);

    // Închide tab-ul după ce scanarea e completă
    // Timing: 20s initial wait + 60s scroll (12×5s) + 20s processing = 100s (original spec)
    setTimeout(() => {
      console.log(`[checkGroup] Closing tab ${tabId}...`);
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.log(`[checkGroup] Tab ${tabId} already closed`);
        } else {
          console.log(`[checkGroup] ✅ Tab ${tabId} closed`);
        }
      });
    }, 100000); // 100 secunde = 10s wait + 60s scroll + 30s buffer
  });
}

// Ascultă mesaje despre postări noi
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verificare manuală din popup
  if (message.type === "check_groups_now") {
    if (isChecking) {
      console.log("⚠️ Already checking groups! Please wait...");
      sendResponse({ status: "already_checking" });
      return true;
    }
    
    console.log("Manual check triggered!");
    console.log("Groups to check:", groups);
    console.log("Number of groups:", groups.length);
    
    isChecking = true;
    
    groups.forEach((group, index) => {
      const delay = index * 30000; // 30 secunde între grupuri
      console.log(`Scheduling checkGroup for "${group.name}" with delay ${delay}ms`);
      
      setTimeout(() => {
        console.log(`Now calling checkGroup for "${group.name}"`);
        checkGroup(group);
      }, delay);
    });
    
    // Reset flag după ce toate verificările sunt complete
    setTimeout(() => {
      isChecking = false;
      console.log("✅ Manual check completed");
    }, groups.length * 30000 + 5000);
    
    sendResponse({ status: "checking" });
    return true;
  }
  
  // Procesează toate postările din ziua curentă
  if (message.type === "posts_from_today") {
    console.log(`[POSTS] Received ${message.posts?.length || 0} posts from ${message.groupName}`);
    
    if (message.error) {
      console.error(`[POSTS] Error from content script: ${message.error}`);
      sendResponse({ status: "error", error: message.error });
      return true;
    }
    
    if (!message.posts || message.posts.length === 0) {
      console.warn(`[POSTS] No posts received from ${message.groupName}`);
      sendResponse({ status: "no_posts" });
      return true;
    }
    
    console.log(`[POSTS] Posts data:`, message.posts);
    
    // Procesează toate posturile într-un singur batch pentru a evita race conditions
    chrome.storage.local.get("pendingPosts", (data) => {
      const existingPosts = data.pendingPosts || [];
      let newPostsCount = 0;
      const newPosts = [];
      
      message.posts.forEach((post, idx) => {
        console.log(`[POSTS] Processing post ${idx + 1}/${message.posts.length}: ${post.postId?.slice(0, 30)}`);
        
        // Verifică dacă postarea a mai fost văzută
        if (!seenPostIds.has(post.postId)) {
          seenPostIds.add(post.postId);
          newPostsCount++;
          
          console.log(`[POSTS] ✅ New post! Will add to pendingPosts...`);
          
          // Adaugă în array temporar
          newPosts.push({
            groupName: message.groupName,
            postId: post.postId,
            postUrl: post.postUrl,
            timeText: post.timeText || 'Necunoscut',
            service: post.service || 'Transport General',
            postText: post.postText || 'Fără text',
            timestamp: Date.now()
          });
          
          // TRIMITE POST CĂTRE PWA BACKEND
          const postData = {
            postId: post.postId,
            postUrl: post.postUrl,
            timeText: post.timeText || 'Necunoscut',
            service: post.service || 'Transport General',
            keyword: post.keyword || 'transport',
            postText: post.postText || 'Fără text',
            timestamp: Date.now()
          };
          
          fetch('http://localhost:3000/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
          })
          .then(response => response.json())
          .then(result => {
            console.log(`[PWA] ✅ Post sent to PWA backend:`, result);
          })
          .catch(err => {
            console.error(`[PWA] ❌ Failed to send post to PWA:`, err.message);
            // Nu oprim procesarea - PWA poate fi offline
          });
        } else {
          console.log(`[POSTS] ⏭️ Post already seen: ${post.postId?.slice(0, 30)}`);
        }
      });
      
      // Salvează toate posturile noi într-o singură operație
      if (newPosts.length > 0) {
        const allPosts = [...existingPosts, ...newPosts];
        chrome.storage.local.set({ pendingPosts: allPosts }, () => {
          console.log(`[POSTS] ✅ Saved ${newPosts.length} new posts! Total pending: ${allPosts.length}`);
        });
      }
      
      // Salvează lista actualizată de post ID-uri văzute
      saveSeenPostIds();
      
      // Notificare pentru toate postările noi găsite
      if (newPostsCount > 0) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: `${newPostsCount} postări noi detectate!`,
          message: `Grup: ${message.groupName}`,
          priority: 2
        });
      }
      
      sendResponse({ status: "processed", newPosts: newPostsCount });
    });
    return true;
  }
});

console.log("Curierul Perfect Assistant - Background worker started!");
