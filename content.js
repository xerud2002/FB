// Facebook Group Scanner - Content Script
// Se încarcă automat pe toate paginile de grupuri Facebook

console.log("[FB Scanner] Content script loaded on:", window.location.href);

// Ascultă comenzi de la background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[FB Scanner] Received message:", message.type);
  
  if (message.type === "scan_for_posts") {
    console.log("[FB Scanner] Starting scan for group:", message.groupName);
    scanPosts(message.groupName).then(posts => {
      console.log("[FB Scanner] Scan complete, found:", posts.length, "posts");
      sendResponse({ posts: posts });
    });
    return true; // async response
  }
  
  if (message.type === "type_comment") {
    typeComment(message.text);
    sendResponse({ status: "typing" });
    return true;
  }
});

// Scanează postările din feed
async function scanPosts(groupName) {
  console.log("[FB Scanner] Scrolling to load posts...");
  
  // Scroll pentru a încărca postări
  for (let i = 0; i < 5; i++) {
    window.scrollBy(0, 1000);
    await sleep(800);
  }
  
  // Scroll înapoi sus
  window.scrollTo(0, 0);
  await sleep(500);
  
  console.log("[FB Scanner] Looking for posts...");
  
  // Găsește postările - Facebook folosește role="article" sau data-pagelet
  let posts = document.querySelectorAll('[role="article"]');
  console.log("[FB Scanner] Found", posts.length, "articles");
  
  if (posts.length === 0) {
    // Fallback pentru alt layout
    posts = document.querySelectorAll('[data-pagelet^="FeedUnit"]');
    console.log("[FB Scanner] Fallback found", posts.length, "FeedUnits");
  }
  
  const foundPosts = [];
  const keywords = ["caut", "cine duce", "cine aduce", "caut transport", "caut platforma"];
  
  Array.from(posts).slice(0, 25).forEach((post, index) => {
    const text = (post.textContent || "").toLowerCase();
    
    // Verifică keywords
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        console.log("[FB Scanner] Post #" + (index+1) + " contains:", keyword);
        
        const url = findPostUrl(post);
        const postText = findPostText(post);
        const time = findPostTime(post);
        
        if (url) {
          foundPosts.push({
            postId: extractPostId(url) || ("post_" + Date.now() + "_" + index),
            postUrl: url,
            postText: postText,
            timeText: time,
            keyword: keyword,
            groupName: groupName
          });
          console.log("[FB Scanner] Added post with URL:", url);
        }
        break; // o singură potrivire per post
      }
    }
  });
  
  return foundPosts;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function findPostUrl(post) {
  // Caută linkuri cu timestamp (sunt permalink-uri)
  const links = post.querySelectorAll("a[href]");
  
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const text = (link.textContent || "").trim();
    
    // Linkuri de timp: "1h", "2m", "3d", etc
    if (/^\d+[mhd]$/.test(text) || /^\d+\s*(min|ora|ore|zi)/.test(text)) {
      if (href.includes("/groups/")) {
        return "https://www.facebook.com" + href.split("?")[0];
      }
    }
    
    // URL-uri directe de post
    if (href.includes("/posts/") || href.includes("/permalink/")) {
      const fullUrl = href.startsWith("http") ? href : "https://www.facebook.com" + href;
      return fullUrl.split("?")[0];
    }
  }
  
  // Fallback: caută în HTML
  const match = post.innerHTML.match(/\/groups\/\d+\/posts\/(\d+)/);
  if (match) {
    const groupId = window.location.pathname.match(/\/groups\/(\d+)/);
    if (groupId) {
      return "https://www.facebook.com/groups/" + groupId[1] + "/posts/" + match[1] + "/";
    }
  }
  
  return null;
}

function findPostText(post) {
  // Găsește cel mai lung text din post (exclude butoane, etc)
  const textEls = post.querySelectorAll('div[dir="auto"], span[dir="auto"]');
  let best = "";
  
  for (const el of textEls) {
    const text = (el.textContent || "").trim();
    if (text.length > best.length && text.length > 20) {
      // Exclude UI text
      if (!/^(like|comment|share|vezi|see more|follow)/i.test(text)) {
        best = text;
      }
    }
  }
  
  return best.substring(0, 300).replace(/\s+/g, " ");
}

function findPostTime(post) {
  const links = post.querySelectorAll("a");
  for (const link of links) {
    const text = (link.textContent || "").trim();
    if (/^\d+[smhd]$/.test(text) || /^(acum|just now|ieri)/i.test(text)) {
      return text;
    }
  }
  return "recent";
}

function extractPostId(url) {
  const match = url.match(/\/posts\/(\d+)/);
  return match ? match[1] : null;
}

// Funcție pentru a scrie comentarii
function typeComment(text) {
  console.log("[FB Scanner] Typing comment:", text);
  
  // Găsește caseta de comentariu
  const boxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
  
  for (const box of boxes) {
    if (box.offsetParent !== null) { // vizibil
      box.focus();
      
      // Folosește execCommand pentru compatibilitate cu React
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      
      // Trigger input event
      box.dispatchEvent(new Event("input", { bubbles: true }));
      
      console.log("[FB Scanner] Comment typed successfully");
      return;
    }
  }
  
  console.log("[FB Scanner] No comment box found");
}
