let currentGroupName = "Unknown Group";

// Ascultă mesajul cu numele grupului de la background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
  }
});

setTimeout(() => {
  try {
    console.log("Searching for ALL posts from today in feed...");
    
    const feed = document.querySelector('[role="feed"]');
    if (!feed) {
      console.warn("Feed not found!");
      return;
    }
    
    // Găsește TOATE postările din feed
    const allPosts = feed.querySelectorAll('div[data-pagelet^="FeedUnit"], div[aria-posinset]');
    console.log(`Found ${allPosts.length} posts in feed`);
    
    const today = new Date();
    const postsToday = [];
    
    allPosts.forEach((post, index) => {
      try {
        // Caută timestamp-ul postării
        const timeLinks = post.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], span[id] a');
        let isToday = false;
        let postUrl = null;
        
        timeLinks.forEach(link => {
          const text = link.innerText?.toLowerCase() || '';
          // Verifică dacă e din azi: "Just now", "1h", "2h", "3 min", etc (fără "d" sau "day")
          if (text.includes('just now') || 
              text.includes('now') ||
              text.includes('min') ||
              (text.includes('h') && !text.includes('d')) ||
              text.match(/^\d+\s*(m|h|min|mins|hr|hrs|hour|hours)$/i)) {
            isToday = true;
            postUrl = link.href;
          }
        });
        
        if (isToday && postUrl) {
          // Extrage ID unic
          let postId = post.getAttribute("data-ad-preview") || 
                       post.id ||
                       post.querySelector('[id]')?.id ||
                       postUrl.split('/').pop() ||
                       post.innerText?.slice(0, 100).replace(/\s+/g, '_');
          
          if (!postUrl.startsWith('http')) {
            postUrl = 'https://www.facebook.com' + postUrl;
          }
          
          postsToday.push({ postId, postUrl });
          console.log(`Post #${index + 1} from today:`, { postId, postUrl });
        }
      } catch (err) {
        console.warn(`Error processing post #${index}:`, err);
      }
    });
    
    console.log(`Total posts from today: ${postsToday.length}`);
    
    // Trimite toate postările din azi către background
    if (postsToday.length > 0) {
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: postsToday,
        groupName: currentGroupName
      });
    } else {
      console.log("No posts from today found");
    }
    
  } catch (err) {
    console.warn("Nu s-a putut detecta postările:", err);
  }
}, 8000); // Așteaptă 8s să se încarce complet pagina
