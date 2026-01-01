// Content Script v6 - DEBUG
console.log("[CS] v6 LOADED");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[CS] GOT MESSAGE:", msg.type);
  
  if (msg.type === "scan_now") {
    console.log("[CS] STARTING SCAN");
    
    setTimeout(() => {
      const articles = document.querySelectorAll('[role="article"]');
      console.log("[CS] ARTICLES:", articles.length);
      
      const results = [];
      
      for (let i = 0; i < articles.length; i++) {
        const art = articles[i];
        const txt = art.textContent || "";
        console.log("[CS] Article", i, "text length:", txt.length);
        
        // Gaseste ORICE link din articol
        const links = art.querySelectorAll("a[href]");
        let url = null;
        
        for (const a of links) {
          const href = a.href || a.getAttribute("href") || "";
          if (href.includes("/groups/") && href.includes("/posts/")) {
            url = href.split("?")[0];
            break;
          }
          if (href.includes("/groups/") && href.match(/\/\d{10,}/)) {
            url = href.split("?")[0];
            break;
          }
        }
        
        if (!url) {
          // Fallback: first /groups/ link
          for (const a of links) {
            const href = a.href || "";
            if (href.includes("/groups/")) {
              url = href.split("?")[0];
              break;
            }
          }
        }
        
        console.log("[CS] Article", i, "URL:", url ? url.substring(0, 60) : "NONE");
        
        if (url) {
          results.push({
            postId: "post" + i + "_" + Date.now(),
            postUrl: url,
            postText: txt.substring(0, 150),
            timeText: "test",
            keyword: "test",
            groupName: msg.groupName || "Test"
          });
        }
      }
      
      console.log("[CS] RESULTS:", results.length);
      
      // Send via message too
      if (results.length > 0) {
        chrome.runtime.sendMessage({type: "scan_results", posts: results});
      }
      
      sendResponse({posts: results});
    }, 3000); // Wait 3s for page
    
    return true;
  }
  
  if (msg.type === "type_comment") {
    const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
    for (const box of boxes) {
      if (box.offsetParent) {
        box.focus();
        document.execCommand("insertText", false, msg.text);
        console.log("[CS] TYPED");
        break;
      }
    }
    sendResponse({ok: true});
  }
});

console.log("[CS] v6 READY");
