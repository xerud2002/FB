// Curierul Perfect - Background v3
console.log("Background started!");

const GROUP = {
  name: "Transport Persoane/Colete/Platforma",
  url: "https://www.facebook.com/groups/1784041808422081"
};

let seenIds = new Set();
let checking = false;

chrome.storage.local.get(["seenPostIds"], (data) => {
  if (data.seenPostIds) {
    seenIds = new Set(data.seenPostIds);
    console.log("Loaded", seenIds.size, "seen IDs");
  }
});

chrome.alarms.create("check", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check" && !checking) {
    console.log("Alarm triggered");
    checkGroup();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Message:", msg.type);
  
  if (msg.type === "check_groups_now") {
    if (!checking) {
      checkGroup();
      sendResponse({ status: "started" });
    } else {
      sendResponse({ status: "busy" });
    }
    return true;
  }
  
  // Primeste rezultate direct de la content script
  if (msg.type === "scan_results") {
    console.log("Got scan results:", msg.posts.length, "posts");
    if (msg.posts.length > 0) {
      processPosts(msg.posts);
    }
    sendResponse({ ok: true });
    return true;
  }
});

async function checkGroup() {
  checking = true;
  console.log("Opening:", GROUP.url);
  
  try {
    const tab = await chrome.tabs.create({ url: GROUP.url, active: false });
    console.log("Tab:", tab.id);
    
    // Asteapta incarcarea
    await waitForLoad(tab.id);
    console.log("Loaded, waiting 10s for feed...");
    
    // Asteapta feed-ul sa se incarce
    await sleep(10000);
    
    // Trimite comanda
    console.log("Sending scan command...");
    
    chrome.tabs.sendMessage(tab.id, {
      type: "scan_now",
      groupName: GROUP.name
    }, (response) => {
      console.log("Scan response:", response);
      
      if (response && response.posts) {
        console.log("Found", response.posts.length, "posts");
        if (response.posts.length > 0) {
          processPosts(response.posts);
        }
      }
      
      // Inchide tab-ul DUPA ce primeste raspunsul
      setTimeout(() => {
        chrome.tabs.remove(tab.id, () => {
          console.log("Tab closed");
          checking = false;
        });
      }, 3000);
    });
    
    // Timeout de siguranta - inchide dupa 30s oricum
    setTimeout(() => {
      if (checking) {
        chrome.tabs.remove(tab.id).catch(() => {});
        checking = false;
        console.log("Timeout - tab closed");
      }
    }, 30000);
    
  } catch (e) {
    console.log("Error:", e.message);
    checking = false;
  }
}

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const check = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(check);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(check);
      resolve();
    }, 15000);
  });
}

function processPosts(posts) {
  console.log("Processing", posts.length, "posts");
  
  const newPosts = posts.filter(p => !seenIds.has(p.postId));
  console.log("New:", newPosts.length);
  
  if (newPosts.length === 0) {
    console.log("All posts already seen");
    return;
  }
  
  newPosts.forEach(p => seenIds.add(p.postId));
  chrome.storage.local.set({ seenPostIds: Array.from(seenIds) });
  
  chrome.storage.local.get("pendingPosts", (data) => {
    const pending = data.pendingPosts || [];
    const updated = [...newPosts, ...pending].slice(0, 50);
    chrome.storage.local.set({ pendingPosts: updated }, () => {
      console.log("Saved! Total:", updated.length);
    });
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Postari noi!",
      message: newPosts.length + " postari cu caut gasite"
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
