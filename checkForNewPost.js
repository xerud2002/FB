let currentGroupName = "Unknown Group";

// Ascultă mesajul cu numele grupului de la background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
  }
});

setTimeout(() => {
  try {
    const feed = document.querySelector('[role="feed"]');
    const post = feed?.querySelector('div[data-pagelet^="FeedUnit"]') || feed?.querySelector('div > div');
    
    // Extrage ID-ul postării
    const postId = post?.getAttribute("data-ad-preview") || 
                   post?.dataset?.ft?.mf_story_key || 
                   post?.innerText?.slice(0, 100);
    
    // Extrage URL-ul postării (caută link-ul de timestamp)
    const postLink = post?.querySelector('a[href*="/posts/"], a[href*="/permalink/"]');
    let postUrl = postLink?.href || window.location.href;
    
    // Asigură-te că URL-ul e complet
    if (postUrl && !postUrl.startsWith('http')) {
      postUrl = 'https://www.facebook.com' + postUrl;
    }
    
    console.log("Post detectat:", { postId, postUrl, groupName: currentGroupName });
    
    // Trimite mesaj către background cu detaliile postării
    chrome.runtime.sendMessage({ 
      type: "new_post_detected", 
      postId,
      postUrl,
      groupName: currentGroupName
    });
    
  } catch (err) {
    console.warn("Nu s-a putut detecta postarea:", err);
  }
}, 5000); // Așteaptă 5s să se încarce pagina
