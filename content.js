// Facebook Group Scanner - Content Script v2
// Se incarca automat pe paginile de grupuri Facebook

(function() {
  console.log("[Scanner] Loaded on:", window.location.href);

  // Verifica daca suntem pe un grup Facebook
  if (!window.location.href.includes("/groups/")) {
    console.log("[Scanner] Not a group page, exiting");
    return;
  }

  // Flag pentru a nu scana de mai multe ori
  if (window.__fbScannerLoaded) {
    console.log("[Scanner] Already loaded, skipping");
    return;
  }
  window.__fbScannerLoaded = true;

  // Asculta comenzi de la background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[Scanner] Message received:", msg.type);
    
    if (msg.type === "scan_now") {
      doScan(msg.groupName).then(posts => {
        sendResponse({ posts: posts });
      });
      return true;
    }
    
    if (msg.type === "type_comment") {
      typeInCommentBox(msg.text);
      sendResponse({ ok: true });
    }
  });

  // Functie pentru a parsa timpul (ex: "2h" -> 2 ore)
  function parseTimeAgo(timeStr) {
    if (!timeStr) return 999;
    const str = timeStr.toLowerCase().trim();
    
    // "Just now", "Acum"
    if (str.includes("now") || str === "acum") return 0;
    
    // "Xm" sau "X min"
    let match = str.match(/^(\d+)\s*m(in)?/);
    if (match) return parseInt(match[1]) / 60;
    
    // "Xh" sau "X hour/ora/ore"
    match = str.match(/^(\d+)\s*(h|hour|ora|ore)/);
    if (match) return parseInt(match[1]);
    
    // "Xd" sau "X day/zi/zile"
    match = str.match(/^(\d+)\s*(d|day|zi)/);
    if (match) return parseInt(match[1]) * 24;
    
    // "Yesterday/Ieri"
    if (str.includes("yesterday") || str.includes("ieri")) return 24;
    
    return 999; // prea vechi
  }

  // Scaneaza feed-ul
  async function doScan(groupName) {
    console.log("[Scanner] Starting scan...");
    
    // Scroll pentru a incarca postari
    for (let i = 0; i < 6; i++) {
      window.scrollBy(0, 1200);
      await delay(700);
    }
    window.scrollTo(0, 0);
    await delay(300);
    
    // Gaseste postarile
    const articles = document.querySelectorAll('[role="article"]');
    console.log("[Scanner] Found", articles.length, "articles");
    
    const results = [];
    const keywords = ["caut", "cine duce", "cine aduce"];
    const MAX_HOURS = 8;
    
    for (let i = 0; i < Math.min(articles.length, 30); i++) {
      const article = articles[i];
      const text = (article.textContent || "").toLowerCase();
      
      // Verifica keywords
      let matchedKeyword = null;
      for (const kw of keywords) {
        if (text.includes(kw)) {
          matchedKeyword = kw;
          break;
        }
      }
      
      if (!matchedKeyword) continue;
      
      // Gaseste timpul
      const timeText = findTime(article);
      const hoursAgo = parseTimeAgo(timeText);
      
      console.log("[Scanner] Post", i, "keyword:", matchedKeyword, "time:", timeText, "hours:", hoursAgo);
      
      // Filtru 8 ore
      if (hoursAgo > MAX_HOURS) {
        console.log("[Scanner] Post too old, skipping");
        continue;
      }
      
      // Gaseste URL
      const url = findUrl(article);
      if (!url) {
        console.log("[Scanner] No URL found, skipping");
        continue;
      }
      
      // Extrage text
      const postContent = findContent(article);
      
      results.push({
        postId: extractId(url) || ("p" + Date.now() + i),
        postUrl: url,
        postText: postContent,
        timeText: timeText,
        keyword: matchedKeyword,
        groupName: groupName || "Unknown"
      });
      
      console.log("[Scanner] Added post:", url);
    }
    
    console.log("[Scanner] Scan complete, found", results.length, "matching posts");
    return results;
  }

  function findTime(article) {
    // Cauta linkuri cu text de timp
    const links = article.querySelectorAll("a");
    for (const link of links) {
      const t = (link.textContent || "").trim();
      if (/^\d+[smhd]$/i.test(t)) return t;
      if (/^\d+\s*(min|sec|hour|ora|ore|zi|day)/i.test(t)) return t;
      if (/^(just now|acum|ieri|yesterday)/i.test(t)) return t;
    }
    return "";
  }

  function findUrl(article) {
    const links = article.querySelectorAll("a[href]");
    
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const t = (link.textContent || "").trim();
      
      // Link de timp = permalink
      if (/^\d+[smhd]$/i.test(t) || /^\d+\s*(min|ora|ore|hour)/i.test(t)) {
        if (href.includes("/groups/")) {
          const clean = href.split("?")[0];
          return clean.startsWith("http") ? clean : "https://www.facebook.com" + clean;
        }
      }
      
      // URL direct de post
      if (href.includes("/posts/") || href.includes("/permalink/")) {
        const clean = href.split("?")[0];
        return clean.startsWith("http") ? clean : "https://www.facebook.com" + clean;
      }
    }
    
    // Fallback: cauta in HTML
    const m = article.innerHTML.match(/\/groups\/(\d+)\/posts\/(\d+)/);
    if (m) {
      return "https://www.facebook.com/groups/" + m[1] + "/posts/" + m[2] + "/";
    }
    
    return null;
  }

  function findContent(article) {
    const els = article.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    let best = "";
    
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (t.length > best.length && t.length > 15) {
        if (!/^(like|comment|share|vezi|see|follow|\d+ comm)/i.test(t)) {
          best = t;
        }
      }
    }
    
    return best.substring(0, 280).replace(/\s+/g, " ");
  }

  function extractId(url) {
    const m = url.match(/\/posts\/(\d+)/);
    return m ? m[1] : null;
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function typeInCommentBox(text) {
    const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
    for (const box of boxes) {
      if (box.offsetParent) {
        box.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, text);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
  }

})();
