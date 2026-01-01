// Content Script FINAL
console.log("[CS] FINAL LOADED");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "scan_now") {
    const articles = document.querySelectorAll('[role="article"]');
    const results = [];
    
    articles.forEach((art, i) => {
      const links = art.querySelectorAll("a[href]");
      let url = null;
      
      for (const link of links) {
        const h = link.href || "";
        if (h.includes("/groups/1784041808422081") && (h.includes("/posts/") || h.includes("/permalink/") || h.match(/\/\d{15,}/))) {
          url = h.split("?")[0].split("#")[0];
          break;
        }
      }
      
      if (url) {
        results.push({
          postId: url.match(/\d{15,}/)?.[0] || ("p" + Date.now() + i),
          postUrl: url,
          postText: (art.textContent || "").substring(0, 200),
          timeText: "recent",
          keyword: "found",
          groupName: msg.groupName
        });
      }
    });
    
    console.log("[CS] Results:", results.length);
    if (results.length) chrome.runtime.sendMessage({type: "scan_results", posts: results});
    sendResponse({posts: results});
    return true;
  }
  
  if (msg.type === "type_comment") {
    const box = document.querySelector('[contenteditable="true"][role="textbox"]');
    if (box) {
      box.focus();
      document.execCommand("insertText", false, msg.text);
    }
    sendResponse({ok: true});
  }
});
