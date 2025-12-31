let currentGroupName = "Unknown Group";

// Ascultă mesajul cu numele grupului de la background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
  }
});

setTimeout(() => {
  try {
    console.log("Searching for posts in feed...");
    
    const feed = document.querySelector('[role="feed"]');
    if (!feed) {
      console.warn("Feed not found!");
      return;
    }
    
    // Caută primul post din feed - diverse variante de selectori
    let post = feed.querySelector('div[data-pagelet^="FeedUnit"]') || 
               feed.querySelector('div[aria-posinset="1"]') ||
               feed.querySelector('div > div > div');
    
    console.log("Post element found:", post);
    
    // Extrage ID-ul postării - încearcă mai multe metode
    let postId = post?.getAttribute("data-ad-preview") || 
                 post?.id ||
                 post?.querySelector('[id]')?.id ||
                 post?.innerText?.slice(0, 150).replace(/\s+/g, '_');
    
    // Extrage URL-ul postării
    const postLink = post?.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[aria-label*="ago"]');
    let postUrl = postLink?.href || window.location.href;
    
    if (postUrl && !postUrl.startsWith('http')) {
      postUrl = 'https://www.facebook.com' + postUrl;
    }
    
    console.log("Post detectat:", { postId, postUrl, groupName: currentGroupName, preview: post?.innerText?.slice(0, 100) });
    
    // Trimite mesaj către background
    if (postId && postUrl) {
      chrome.runtime.sendMessage({ 
        type: "new_post_detected", 
        postId,
        postUrl,
        groupName: currentGroupName
      });
    } else {
      console.warn("Could not extract post ID or URL");
    }
    
  } catch (err) {
    console.warn("Nu s-a putut detecta postarea:", err);
  }
}, 7000); // Așteaptă 7s să se încarce complet pagina
