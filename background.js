// Background v5
console.log("BG Started");

const GROUP = {
  name: "Transport",
  url: "https://www.facebook.com/groups/1784041808422081"
};

let seen = new Set();
let busy = false;
let popupWindowId = null;

// Open popup as separate window on extension icon click
chrome.action.onClicked.addListener(() => {
  if (popupWindowId) {
    chrome.windows.update(popupWindowId, {focused: true});
  } else {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 340,
      height: 600,
      focused: true
    }, (win) => {
      popupWindowId = win.id;
    });
  }
});

chrome.windows.onRemoved.addListener((winId) => {
  if (winId === popupWindowId) popupWindowId = null;
});

chrome.storage.local.get(["seenPostIds"], d => {
  if (d.seenPostIds) seen = new Set(d.seenPostIds);
});

chrome.alarms.create("chk", {periodInMinutes: 5});
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === "chk" && !busy) doCheck();
});

chrome.runtime.onMessage.addListener((m, s, send) => {
  console.log("BG msg:", m.type);
  
  if (m.type === "check_groups_now") {
    if (!busy) doCheck();
    send({ok: !busy});
    return true;
  }
  
  if (m.type === "scan_results") {
    console.log("BG scan_results:", m.posts?.length, "posts");
    if (m.posts?.length) savePosts(m.posts);
    send({ok:true});
    return true;
  }
});

async function doCheck() {
  busy = true;
  console.log("BG: Opening", GROUP.url);
  
  const tab = await chrome.tabs.create({url: GROUP.url, active: false});
  console.log("BG: Tab", tab.id);
  
  // Wait for page load
  await new Promise(r => {
    const fn = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(fn);
        r();
      }
    };
    chrome.tabs.onUpdated.addListener(fn);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); r(); }, 30000);
  });
  
  console.log("BG: Page loaded, waiting 3s...");
  await sleep(3000);
  
  console.log("BG: Sending scan_now...");
  
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      type: "scan_now",
      groupName: GROUP.name
    });
    console.log("BG: Response posts:", resp?.posts?.length);
    if (resp?.posts?.length) {
      savePosts(resp.posts);
    }
  } catch(e) {
    console.log("BG: Error:", e.message);
  }
  
  // Keep tab open for 2 minutes before closing
  console.log("BG: Keeping tab open for 120s...");
  await sleep(120000);
  
  try { await chrome.tabs.remove(tab.id); } catch(e) {}
  console.log("BG: Done");
  busy = false;
}

function savePosts(posts) {
  const newP = posts.filter(p => !seen.has(p.postId));
  console.log("BG: New posts:", newP.length, "of", posts.length);
  
  if (!newP.length) return;
  
  newP.forEach(p => seen.add(p.postId));
  chrome.storage.local.set({seenPostIds: [...seen]});
  
  chrome.storage.local.get("pendingPosts", d => {
    const all = [...newP, ...(d.pendingPosts || [])].slice(0, 50);
    chrome.storage.local.set({pendingPosts: all});
    console.log("BG: SAVED! Total pending:", all.length);
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png", 
      title: "Postari noi!",
      message: newP.length + " postari gasite"
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
