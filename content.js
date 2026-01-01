// Content Script v5
console.log("[CS] Loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[CS] Got:", msg.type);
  
  if (msg.type === "scan_now") {
    doScan(msg.groupName).then(posts => {
      console.log("[CS] Sending", posts.length, "posts");
      sendResponse({posts: posts});
    });
    return true; // async
  }
  
  if (msg.type === "type_comment") {
    typeComment(msg.text);
    sendResponse({ok: true});
  }
});

async function doScan(groupName) {
  console.log("[CS] Starting scan...");
  
  // Scroll pentru a incarca postari
  for (let i = 0; i < 8; i++) {
    window.scrollBy(0, 800);
    await sleep(600);
  }
  
  // Cauta articole
  const articles = document.querySelectorAll('[role="article"]');
  console.log("[CS] Found", articles.length, "articles");
  
  const kws = ["caut", "cine duce", "cine aduce"];
  const results = [];
  
  articles.forEach((art, idx) => {
    const txt = (art.textContent || "").toLowerCase();
    
    // Check keyword
    const kw = kws.find(k => txt.includes(k));
    if (!kw) return;
    
    // Get time
    const timeStr = findTime(art);
    const hrs = toHours(timeStr);
    console.log("[CS]", idx, "keyword:", kw, "time:", timeStr, "hours:", hrs);
    
    if (hrs > 8) return;
    
    // Get URL
    const url = findUrl(art);
    if (!url) {
      console.log("[CS]", idx, "no URL found");
      return;
    }
    
    const postId = url.match(/\/(\d+)/)?.[1] || ("id" + Date.now() + idx);
    
    results.push({
      postId: postId,
      postUrl: url,
      postText: findText(art),
      timeText: timeStr,
      keyword: kw,
      groupName: groupName
    });
    
    console.log("[CS] + Added:", url.substring(0, 60));
  });
  
  console.log("[CS] Results:", results.length);
  
  // Backup send
  if (results.length > 0) {
    try {
      chrome.runtime.sendMessage({type: "scan_results", posts: results});
    } catch(e) {}
  }
  
  return results;
}

function findTime(el) {
  const links = el.querySelectorAll("a");
  for (const a of links) {
    const t = a.textContent?.trim() || "";
    // 5m, 2h, 1d, etc
    if (/^\d+[mhd]$/i.test(t)) return t;
    // 5 min, 2 ore, etc
    if (/^\d+\s*(min|ora|ore|hour|hr)/i.test(t)) return t;
    // Just now
    if (/^(acum|just now)/i.test(t)) return "0m";
  }
  return "";
}

function toHours(s) {
  if (!s) return 999;
  s = s.toLowerCase();
  
  let m = s.match(/^(\d+)m$/i);
  if (m) return parseInt(m[1]) / 60;
  
  m = s.match(/^(\d+)h$/i);
  if (m) return parseInt(m[1]);
  
  m = s.match(/^(\d+)d$/i);
  if (m) return parseInt(m[1]) * 24;
  
  m = s.match(/(\d+)\s*min/i);
  if (m) return parseInt(m[1]) / 60;
  
  m = s.match(/(\d+)\s*(ora|ore|hour|hr)/i);
  if (m) return parseInt(m[1]);
  
  return 999;
}

function findUrl(el) {
  const links = el.querySelectorAll("a[href]");
  
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    const txt = a.textContent?.trim() || "";
    
    // Time link = permalink
    if (/^\d+[mhd]$/i.test(txt) || /^\d+\s*(min|ora)/i.test(txt)) {
      if (href.includes("/groups/")) {
        const clean = href.split("?")[0];
        return clean.startsWith("http") ? clean : "https://www.facebook.com" + clean;
      }
    }
  }
  
  // Fallback: any /posts/ or /permalink/
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    if (href.includes("/posts/") || href.includes("/permalink/")) {
      const clean = href.split("?")[0];
      return clean.startsWith("http") ? clean : "https://www.facebook.com" + clean;
    }
  }
  
  return null;
}

function findText(el) {
  let best = "";
  el.querySelectorAll('div[dir="auto"]').forEach(d => {
    const t = (d.textContent || "").trim();
    if (t.length > best.length && t.length > 20) {
      best = t;
    }
  });
  return best.substring(0, 200);
}

function typeComment(text) {
  const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
  for (const box of boxes) {
    if (box.offsetParent) {
      box.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, text);
      box.dispatchEvent(new Event('input', {bubbles: true}));
      console.log("[CS] Typed comment");
      return;
    }
  }
  console.log("[CS] No comment box found");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
