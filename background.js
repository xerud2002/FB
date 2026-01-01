// Lista grupuri de monitorizat (sincronizată cu popup.js)
const groups = [
  { name: "Test Group", url: "https://www.facebook.com/groups/1784041808422081" }
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
  console.log(`[checkGroup] Starting check for: ${group.name}`);
  console.log(`[checkGroup] URL: ${group.url}`);
  
  chrome.tabs.create({ url: group.url, active: false }, (tab) => {
    const tabId = tab.id;
    console.log(`[checkGroup] Tab created with ID: ${tabId}`);

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
    }, 3000);

    // Închide tab-ul după 35 secunde (mai mult timp pentru scanare)
    setTimeout(() => {
      console.log(`[checkGroup] Closing tab ${tabId}...`);
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.log(`[checkGroup] Tab ${tabId} already closed`);
        } else {
          console.log(`[checkGroup] ✅ Tab ${tabId} closed`);
        }
      });
    }, 35000);
  });
}

// Ascultă mesaje despre postări noi
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verificare manuală din popup
  if (message.type === "check_groups_now") {
    console.log("Manual check triggered!");
    console.log("Groups to check:", groups);
    console.log("Number of groups:", groups.length);
    
    groups.forEach((group, index) => {
      const delay = index * 5000;
      console.log(`Scheduling checkGroup for "${group.name}" with delay ${delay}ms`);
      
      setTimeout(() => {
        console.log(`Now calling checkGroup for "${group.name}"`);
        checkGroup(group);
      }, delay);
    });
    
    sendResponse({ status: "checking" });
    return true;
  }
  
  // Procesează toate postările din ziua curentă
  if (message.type === "posts_from_today") {
    console.log(`[POSTS] Received ${message.posts?.length || 0} posts from ${message.groupName}`);
    console.log(`[POSTS] Posts data:`, message.posts);
    
    if (!message.posts || message.posts.length === 0) {
      console.warn(`[POSTS] No posts received!`);
      sendResponse({ status: "no_posts" });
      return true;
    }
    
    let newPostsCount = 0;
    
    message.posts.forEach((post, idx) => {
      console.log(`[POSTS] Processing post ${idx + 1}/${message.posts.length}: ${post.postId?.slice(0, 30)}`);
      
      // Verifică dacă postarea a mai fost văzută
      if (!seenPostIds.has(post.postId)) {
        seenPostIds.add(post.postId);
        newPostsCount++;
        
        console.log(`[POSTS] ✅ New post! Adding to pendingPosts...`);
        
        // Adaugă postarea în lista de pending
        chrome.storage.local.get("pendingPosts", (data) => {
          const posts = data.pendingPosts || [];
          
          posts.push({
            groupName: message.groupName,
            postId: post.postId,
            postUrl: post.postUrl,
            timestamp: Date.now()
          });
          
          chrome.storage.local.set({ pendingPosts: posts }, () => {
            console.log(`[POSTS] ✅ Saved! Total pending posts: ${posts.length}`);
          });
        });
      } else {
        console.log(`[POSTS] ⏭️ Post already seen: ${post.postId?.slice(0, 30)}`);
      }
    });
    
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
    
    sendResponse({ status: "processed" });
    return true;
  }
  
  // Backwards compatibility - postare unică
  if (message.type === "new_post_detected") {
    // Verifică dacă e un post nevăzut
    if (!seenPostIds.has(message.postId)) {
      seenPostIds.add(message.postId);
      saveSeenPostIds();
      
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
            message: `Grup: ${message.groupName}`,
            priority: 2
          });
        });
      });
    }
    
    sendResponse({ status: "received" });
    return true;
  }
});

console.log("Curierul Perfect Assistant - Background worker started!");
