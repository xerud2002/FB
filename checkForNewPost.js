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
        
        // Caută link cu timestamp și permalink - mai multe metode
        allLinks.forEach(link => {
          const href = link.href || '';
          const text = (link.innerText || link.textContent || '').toLowerCase().trim();
          const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
          
          // Log doar link-uri relevante
          if (href && (href.includes('/posts/') || href.includes('/permalink/') || text.match(/\d+\s*(m|h|min|hour)/))) {
            console.log(`  Link: "${text.slice(0, 40)}" | aria: "${ariaLabel.slice(0, 40)}" | href: ${href.slice(0, 80)}`);
          }
          
          // Metoda 1: Link-uri cu /posts/ sau /permalink/ în URL
          if ((href.includes('/posts/') || href.includes('/permalink/')) && !postUrl) {
            postUrl = href;
            timeText = text || ariaLabel;
            console.log(`  ✅ Method 1: Found permalink, time: "${timeText}"`);
          }
          
          // Metoda 2: Link-uri cu timestamp pattern în text (2m, 5h, etc)
          if (!postUrl && text.match(/^\d+\s*(m|min|h|hr|hour|minute)/i)) {
            // Găsește cel mai apropiat link de postare din parinte
            let parent = link.parentElement;
            let attempts = 0;
            while (parent && attempts < 5) {
              const parentLinks = parent.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]');
              if (parentLinks.length > 0) {
                postUrl = parentLinks[0].href;
                timeText = text;
                console.log(`  ✅ Method 2: Found via parent traverse, time: "${timeText}"`);
                break;
              }
              parent = parent.parentElement;
              attempts++;
            }
          }
        });
        
        // Metoda 3: Fallback - construiește URL din group + găsește story_fbid în HTML
        if (!postUrl) {
          const postHtml = post.innerHTML || '';
          const storyMatch = postHtml.match(/story_fbid[=\/](\d+)/);
          const pfbidMatch = postHtml.match(/pfbid[A-Za-z0-9]+/);
          
          if (storyMatch || pfbidMatch) {
            const groupId = window.location.pathname.split('/')[2];
            const storyId = storyMatch ? storyMatch[1] : pfbidMatch[0];
            postUrl = `https://www.facebook.com/groups/${groupId}/posts/${storyId}/`;
            console.log(`  ✅ Method 3: Constructed URL from story_fbid`);
          }
        }
        
        // Verifică dacă postarea e din ultima oră
        let isWithinLastHour = false;
        if (timeText) {
          const t = timeText.toLowerCase();
          // "just now", "now", "Xm", "X min" unde X < 60
          if (t.includes('just now') || t === 'now') {
            isWithinLastHour = true;
          } else if (t.match(/^\d+\s*(m|min|mins|minute|minutes)$/)) {
            // Extrage numărul de minute
            const minutes = parseInt(t.match(/\d+/)[0]);
            if (minutes < 60) {
              isWithinLastHour = true;
            }
          } else if (t === '1h' || t === '1 h' || t === '1 hr' || t === '1 hour') {
            // Exact 1 oră - limită
            isWithinLastHour = true;
          }
        }
        
        if (postUrl && isWithinLastHour) {
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
        } else if (postUrl && !isWithinLastHour) {
          console.log(`  ⏰ Post #${index + 1} skipped - older than 1 hour: "${timeText}"`);
        } else {
          console.log(`  ⚠️ No permalink found for post #${index + 1}`);
        }
      } catch (err) {
        console.error(`❌ Error processing post #${index}:`, err);
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total posts from last hour: ${postsToday.length}`);
    console.log(`Group: ${currentGroupName}`);
    
    // Trimite doar postările din ultima oră
    if (postsToday.length > 0) {
      console.log("📤 Sending posts to background...");
      console.log("Posts to send:", postsToday);
      
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: postsToday,
        groupName: currentGroupName
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Error sending message:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ Response from background:", response);
        }
      });
    } else {
      console.error("❌ No posts from last hour found!");
      console.log("Total posts scanned:", allPosts.length);
    }
    
  } catch (err) {
    console.error("❌ Fatal error in post detection:", err);
  }
}, 10000); // Așteaptă 10s să se încarce complet pagina
