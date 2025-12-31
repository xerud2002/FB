let currentGroupName = "Unknown Group";

// Ascultă mesajul cu numele grupului de la background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
    console.log("Received group name:", currentGroupName);
    sendResponse({ status: "received" });
  }
  return true; // Keep message channel open
});

setTimeout(() => {
  try {
    console.log("=== STARTING POST DETECTION ===");
    console.log("Current group:", currentGroupName);
    console.log("Page URL:", window.location.href);
    
    const feed = document.querySelector('[role="feed"]');
    if (!feed) {
      console.error("❌ Feed not found! Selectors might have changed.");
      return;
    }
    
    console.log("✅ Feed found!");
    
    // Găsește TOATE postările din feed - încearcă mai multe selectoare
    let allPosts = feed.querySelectorAll('div[data-pagelet^="FeedUnit"]');
    if (allPosts.length === 0) {
      allPosts = feed.querySelectorAll('div[aria-posinset]');
    }
    if (allPosts.length === 0) {
      allPosts = feed.querySelectorAll('div[role="article"]');
    }
    
    console.log(`Found ${allPosts.length} total posts in feed`);
    
    if (allPosts.length === 0) {
      console.error("❌ No posts found with any selector!");
      return;
    }
    
    const postsToday = [];
    
    allPosts.forEach((post, index) => {
      try {
        // Găsește TOATE link-urile din postare
        const allLinks = post.querySelectorAll('a');
        console.log(`Post #${index + 1}: Found ${allLinks.length} links`);
        
        let postUrl = null;
        let timeText = '';
        
        // Caută link cu timestamp și permalink
        allLinks.forEach(link => {
          const href = link.href || '';
          const text = link.innerText?.toLowerCase() || '';
          
          console.log(`  Link text: "${text.slice(0, 50)}" | href: ${href.slice(0, 80)}`);
          
          // Dacă găsește link de permalink
          if ((href.includes('/posts/') || href.includes('/permalink/')) && !postUrl) {
            postUrl = href;
            timeText = text;
            console.log(`  ✅ Found permalink with time: "${text}"`);
          }
        });
        
        if (postUrl) {
          // Extrage ID unic din URL
          const urlParts = postUrl.split('/');
          let postId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
          
          if (!postId || postId.includes('?')) {
            postId = post.id || post.getAttribute("data-ad-preview") || 
                     post.querySelector('[id]')?.id || 
                     `post_${index}_${Date.now()}`;
          }
          
          if (!postUrl.startsWith('http')) {
            postUrl = 'https://www.facebook.com' + postUrl;
          }
          
          postsToday.push({ postId, postUrl, timeText });
          console.log(`✅ Added post #${index + 1}: ID=${postId.slice(0, 30)}, Time="${timeText}"`);
        } else {
          console.log(`  ⚠️ No permalink found for post #${index + 1}`);
        }
      } catch (err) {
        console.error(`❌ Error processing post #${index}:`, err);
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total posts detected: ${postsToday.length}`);
    console.log(`Group: ${currentGroupName}`);
    
    // Trimite TOATE postările găsite (nu filtrăm după timp aici)
    if (postsToday.length > 0) {
      console.log("Sending posts to background...");
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: postsToday,
        groupName: currentGroupName
      }, (response) => {
        console.log("Response from background:", response);
      });
    } else {
      console.error("❌ No posts with permalinks found!");
    }
    
  } catch (err) {
    console.error("❌ Fatal error in post detection:", err);
  }
}, 10000); // Așteaptă 10s să se încarce complet pagina
