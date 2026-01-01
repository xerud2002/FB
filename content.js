// Content Script v4
(function() {
  console.log("[S] Loaded:", location.href);
  if (!location.href.includes("/groups/")) return;
  if (window._sc) return;
  window._sc = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[S] Message:", msg.type);
    
    if (msg.type === "scan_now") {
      scan(msg.groupName).then(r => sendResponse({posts: r}));
      return true;
    }
    
    if (msg.type === "type_comment") {
      typeComment(msg.text);
      sendResponse({ok:true});
    }
  });

  async function scan(groupName) {
    console.log("[S] Waiting for feed...");
    
    // Asteapta pana apar articole (max 20 sec)
    let articles = [];
    for (let i = 0; i < 20; i++) {
      articles = document.querySelectorAll('[role="article"]');
      console.log("[S] Check", i, "- found", articles.length);
      if (articles.length >= 3) break;
      window.scrollBy(0, 500);
      await sleep(1000);
    }
    
    if (articles.length === 0) {
      console.log("[S] No articles found!");
      return [];
    }
    
    // Scroll mai mult
    console.log("[S] Scrolling...");
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, 1500);
      await sleep(800);
    }
    
    // Re-query dupa scroll
    articles = document.querySelectorAll('[role="article"]');
    console.log("[S] After scroll:", articles.length, "articles");
    
    const results = [];
    const kws = ["caut", "cine duce", "cine aduce"];
    
    for (let i = 0; i < Math.min(articles.length, 30); i++) {
      const a = articles[i];
      const txt = (a.textContent || "").toLowerCase();
      
      let kw = kws.find(k => txt.includes(k));
      if (!kw) continue;
      
      const time = getTime(a);
      const hrs = parseHrs(time);
      
      console.log("[S]", i, "kw:", kw, "time:", time, "hrs:", hrs);
      
      if (hrs > 8) continue;
      
      const url = getUrl(a);
      if (!url) continue;
      
      results.push({
        postId: url.match(/\/(\d+)\/?$/)?.[1] || ("p"+Date.now()+i),
        postUrl: url,
        postText: getContent(a),
        timeText: time,
        keyword: kw,
        groupName: groupName
      });
      console.log("[S] Added:", url);
    }
    
    console.log("[S] Total:", results.length);
    
    // Send backup
    if (results.length > 0) {
      chrome.runtime.sendMessage({type:"scan_results", posts:results});
    }
    
    return results;
  }

  function getTime(el) {
    for (const a of el.querySelectorAll("a")) {
      const t = a.textContent?.trim() || "";
      if (/^\d+[smhd]$/i.test(t)) return t;
      if (/^\d+\s*(min|ora|ore|hour)/i.test(t)) return t;
      if (/^(acum|just|ieri)/i.test(t)) return t;
    }
    return "";
  }

  function parseHrs(s) {
    if (!s) return 999;
    s = s.toLowerCase();
    if (s.includes("now") || s === "acum") return 0;
    let m = s.match(/(\d+)\s*m/); if (m) return +m[1]/60;
    m = s.match(/(\d+)\s*h/); if (m) return +m[1];
    m = s.match(/(\d+)\s*(ora|ore)/); if (m) return +m[1];
    m = s.match(/(\d+)\s*d/); if (m) return +m[1]*24;
    if (s.includes("ieri")) return 24;
    return 999;
  }

  function getUrl(el) {
    for (const a of el.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href") || "";
      const t = a.textContent?.trim() || "";
      
      // Time links = permalinks
      if (/^\d+[smhd]$/i.test(t) || /^\d+\s*(min|ora)/i.test(t)) {
        if (h.includes("/groups/")) {
          return h.startsWith("http") ? h.split("?")[0] : "https://www.facebook.com" + h.split("?")[0];
        }
      }
      if (h.includes("/posts/") || h.includes("/permalink/")) {
        return h.startsWith("http") ? h.split("?")[0] : "https://www.facebook.com" + h.split("?")[0];
      }
    }
    return null;
  }

  function getContent(el) {
    let best = "";
    for (const d of el.querySelectorAll('div[dir="auto"]')) {
      const t = d.textContent?.trim() || "";
      if (t.length > best.length && t.length > 20 && !/^(like|share|comment)/i.test(t)) {
        best = t;
      }
    }
    return best.substring(0, 200);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function typeComment(text) {
    const box = document.querySelector('[contenteditable="true"][role="textbox"]');
    if (box) {
      box.focus();
      document.execCommand("insertText", false, text);
    }
  }
})();
