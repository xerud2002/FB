// Optimized script pentru detecție posturi Facebook
console.log("🚀 checkForNewPost.js LOADED!");
console.log("Script location:", window.location.href);

let currentGroupName = "Unknown Group";

// Ascultă mesajul cu numele grupului
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
    console.log("✅ Received group name:", currentGroupName);
    sendResponse({ status: "received" });
  }
  return true;
});

// Helper function: Verifică dacă timestamp-ul e în intervalul acceptat (ultimele 12 ore)
function isTimeWithinRange(timeText) {
  const t = timeText.toLowerCase();
  
  // Acceptă timestamp unknown
  if (t === 'unknown') return { valid: true, reason: "Unknown timestamp" };
  
  // Just now / acum / seconds
  if (t.includes('just now') || t.includes('acum') || t === 'now' || t.includes('second') || t.includes('secund')) {
    return { valid: true, reason: "Just now" };
  }
  
  // Minutes (0-720 = 12 ore)
  const minMatch = t.match(/(\d+)\s*(m|min|mins|minute|minutes|minut)/i);
  if (minMatch) {
    const minutes = parseInt(minMatch[1]);
    return { valid: minutes <= 720, reason: `${minutes} minutes` };
  }
  
  // Hours (0-12 ore)
  const hourMatch = t.match(/(\d+)\s*(h|hr|hour|hours|oră|ore)/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    return { valid: hours <= 12, reason: `${hours} hours` };
  }
  
  // Days - REJECTEAZĂ (orice zi e > 12 ore)
  const dayMatch = t.match(/(\d+)\s*(d|day|days|zi|zile)/i);
  if (dayMatch) {
    return { valid: false, reason: "More than 12 hours old" };
  }
  
  // "Yesterday" / "Ieri" - REJECTEAZĂ
  if (t.match(/yesterday|ieri/i)) {
    return { valid: false, reason: "More than 12 hours old" };
  }
  
  // Named weekdays - REJECTEAZĂ
  if (t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|luni|marți|miercuri|joi|vineri|sâmbătă|duminică/i)) {
    return { valid: false, reason: "More than 12 hours old" };
  }
  
  // Weeks/months - REJECTEAZĂ
  if (t.match(/\d+\s*(w|week|weeks|săptămân|month|luni)/i)) {
    return { valid: false, reason: "More than 12 hours old" };
  }
  
  return { valid: false, reason: "Unknown format" };
}

// Helper function: Verifică dacă postarea conține "caut" (cineva caută transport)
function containsTransportKeywords(postElement) {
  // Găsește doar textul principal al postării - MULT MAI SPECIFIC
  let mainContent = null;
  
  // Priority 1: Actual post message containers
  const messageSelectors = [
    '[data-ad-preview="message"]',
    '[data-ad-comet-preview="message"]',
    'div[data-ad-comet-preview="message"] div[dir="auto"]',
    'div[class*="userContent"] div[dir="auto"]',
    'div[role="article"] div[dir="auto"][style*="text-align"]',
    'div[data-pagelet*="FeedUnit"] div[dir="auto"]:not([role="button"])'
  ];
  
  for (const selector of messageSelectors) {
    mainContent = postElement.querySelector(selector);
    if (mainContent && mainContent.textContent.length > 30) {
      console.log(`  🎯 Found content with selector: ${selector}`);
      break;
    }
  }
  
  // Fallback: Find longest div[dir="auto"] that's not a button
  if (!mainContent || mainContent.textContent.length < 30) {
    const allDivs = postElement.querySelectorAll('div[dir="auto"]');
    const candidates = [];
    
    allDivs.forEach(div => {
      // Skip buttons, links, and UI elements
      if (div.closest('[role="button"]') || div.closest('a[aria-label]')) {
        return;
      }
      
      const text = (div.textContent || '').trim();
      const lowerText = text.toLowerCase();
      
      // Skip common UI text
      if (text.length < 20) return;
      if (lowerText === 'facebook' || lowerText.startsWith('facebook\n')) return;
      if (lowerText.match(/^(like|comment|share|react|follow)$/i)) return;
      
      candidates.push({ div, text, length: text.length });
    });
    
    // Sort by length and take longest
    candidates.sort((a, b) => b.length - a.length);
    mainContent = candidates.length > 0 ? candidates[0].div : postElement;
    console.log(`  🔍 Fallback: Found ${candidates.length} candidates, longest: ${candidates[0]?.length || 0} chars`);
  }
  
  let originalText = (mainContent.textContent || '').trim();
  
  // Clean up repeated "Facebook" strings
  originalText = originalText.replace(/Facebook\s*/g, '').trim();
  
  const text = originalText.toLowerCase();
  
  // Debug: Arată primele 100 caractere din text
  console.log(`  📝 Post text: "${originalText.substring(0, 100)}..."`);
  
  // SIMPLU: Dacă conține "caut" → AFIȘEAZĂ
  if (text.includes('caut')) {
    console.log(`  ✅ CERERE CLIENT: Conține "caut"`);
    // Returnează textul complet al postării (max 200 caractere)
    const shortText = originalText.length > 200 ? originalText.substring(0, 200) + '...' : originalText;
    return { relevant: true, service: '🚚 Transport', keyword: 'caut', postText: shortText };
  }
  
  console.log(`  ⏭️ POST IGNORAT: Nu conține "caut"`);
  return { relevant: false, reason: 'no_caut_keyword' };
}

// Helper function: Extrage permalink și timestamp din postare
function extractPostInfo(post) {
  const allLinks = post.querySelectorAll('a[href]');
  let postUrl = null;
  let timeText = '';
  
  console.log(`  📊 Total links found: ${allLinks.length}`);
  
  // METODA 1: Caută link-ul cu timestamp (cel mai de încredere!)
  // Facebook pune timestampul ca link direct la post
  for (const link of allLinks) {
    const href = link.href || '';
    const text = (link.innerText || link.textContent || '').trim();
    
    // Skip links fără href valid
    if (!href || href === '#' || href.includes('javascript:')) continue;
    
    // Caută patterns de timp: "4m", "2h", "1d", "December 30", etc.
    const isTimeLink = text.match(/^(\d+\s*(s|sec|m|min|h|hr|d|w|ore?|zi|săpt)[a-zăâîșț]*\.?\s*(ago)?|just now|acum|yesterday|ieri|\w+\s+\d{1,2}(,?\s*\d{4})?(\s+at\s+\d+:\d+\s*(AM|PM)?)?|december|ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie)/i);
    
    if (isTimeLink && href.includes('facebook.com')) {
      // Verifică dacă e link la post (nu la profil sau altceva)
      if (href.includes('/posts/') || href.includes('/permalink/') || href.includes('story_fbid') || href.match(/\/groups\/\d+\/\d+/)) {
        postUrl = href.split('?')[0];
        timeText = text;
        console.log(`  ⏰✅ Timestamp link found: "${text}" → ${postUrl.substring(0, 80)}`);
        break;
      }
    }
  }
  
  // METODA 2: Caută direct URL-uri cu pattern de post
  if (!postUrl) {
    console.log(`  🔍 Searching for post URL patterns...`);
    for (const link of allLinks) {
      const href = link.href || '';
      
      // Pattern: /groups/ID/posts/POSTID sau /groups/ID/permalink/POSTID
      if (href.match(/facebook\.com\/groups\/\d+\/(posts|permalink)\/\d+/)) {
        postUrl = href.split('?')[0];
        console.log(`  ✅ Found post URL pattern: ${postUrl.substring(0, 80)}`);
        break;
      }
      
      // Pattern: story_fbid
      if (href.includes('story_fbid=')) {
        postUrl = href;
        console.log(`  ✅ Found story_fbid URL`);
        break;
      }
      
      // Pattern: pfbid (new Facebook format)
      if (href.match(/facebook\.com\/groups\/[^\/]+\/posts\/pfbid/)) {
        postUrl = href.split('?')[0];
        console.log(`  ✅ Found pfbid URL: ${postUrl.substring(0, 80)}`);
        break;
      }
    }
  }
  
  // METODA 3: Caută în HTML pentru IDs ascunse
  if (!postUrl) {
    console.log(`  🔍 Searching HTML for hidden IDs...`);
    const postHtml = post.outerHTML || '';
    
    // Caută story_fbid în atribute
    const storyMatch = postHtml.match(/story_fbid[=:](\d+)/);
    const pfbidMatch = postHtml.match(/(pfbid[A-Za-z0-9]{20,})/);
    const postIdMatch = postHtml.match(/\/posts\/(\d{10,})/);
    
    const groupId = window.location.pathname.match(/\/groups\/(\d+)/)?.[1];
    
    if (groupId && (storyMatch || pfbidMatch || postIdMatch)) {
      const postId = postIdMatch?.[1] || storyMatch?.[1] || pfbidMatch?.[1];
      postUrl = `https://www.facebook.com/groups/${groupId}/posts/${postId}/`;
      console.log(`  🔨 Constructed URL: ${postUrl}`);
    }
  }
  
  // METODA 4: Caută "See more" sau alte link-uri de tip permalink
  if (!postUrl) {
    console.log(`  🔍 Searching for See more / expand links...`);
    const seeMoreLinks = post.querySelectorAll('a[role="button"], a[aria-expanded]');
    for (const link of seeMoreLinks) {
      const href = link.href || '';
      if (href.includes('/posts/') || href.includes('/permalink/')) {
        postUrl = href.split('?')[0];
        console.log(`  ✅ Found via See more: ${postUrl.substring(0, 80)}`);
        break;
      }
    }
  }
  
  // Extract timestamp dacă nu l-am găsit încă
  if (!timeText) {
    // Caută în text pentru patterns de timp
    const timeElements = post.querySelectorAll('a[href*="facebook.com"], span[id]');
    for (const el of timeElements) {
      const text = (el.textContent || '').trim();
      if (text.match(/^\d+\s*(s|m|h|d|w|min|ore?|zi)/i) || text.match(/^(just now|acum|yesterday|ieri)/i)) {
        timeText = text;
        break;
      }
    }
    
    if (!timeText) timeText = 'Acum';
  }
  
  // Final logging
  if (postUrl) {
    console.log(`  ✅ Final URL: ${postUrl.substring(0, 80)}`);
  } else {
    console.log(`  ⚠️ No URL found - will skip this post!`);
  }
  
  return { postUrl, timeText };
}

// Helper function: Extrage ID din URL
function extractPostId(url, post, index) {
  const urlParts = url.split('/');
  let postId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
  
  if (!postId || postId.includes('?')) {
    postId = post.id || post.getAttribute("data-ad-preview") || 
             post.querySelector('[id]')?.id || 
             `post_${index}_${Date.now()}`;
  }
  
  return postId;
}

// Main detection logic
setTimeout(() => {
  try {
    console.log("=== STARTING FULL FEED SCAN ===");
    console.log("Group:", currentGroupName);
    console.log("URL:", window.location.href);
    
    // Scroll pentru a încărca mai multe postări
    console.log("📜 Scrolling to load more posts...");
    let scrollAttempts = 0;
    const maxScrolls = 12;
    
    const scrollInterval = setInterval(() => {
      window.scrollTo(0, document.body.scrollHeight);
      scrollAttempts++;
      console.log(`  Scroll ${scrollAttempts}/${maxScrolls}...`);
      
      if (scrollAttempts >= maxScrolls) {
        clearInterval(scrollInterval);
        console.log("✅ Scroll complete, starting scan...");
        scanFeed();
      }
    }, 5000);
    
  } catch (err) {
    console.error("❌ Fatal error:", err);
  }
}, 20000); // Wait 20s for initial page load (original spec)

// Funcție de scanare feed
function scanFeed() {
  try {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) {
      console.error("❌ Feed not found!");
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: [],
        groupName: currentGroupName,
        error: "Feed not found"
      });
      return;
    }
    
    console.log("✅ Feed found!");
    
    // Try multiple selectors
    const selectors = [
      { name: 'data-pagelet', query: 'div[data-pagelet^="FeedUnit"]' },
      { name: 'aria-posinset', query: 'div[aria-posinset]' },
      { name: 'role=article', query: 'div[role="article"]' }
    ];
    
    let allPosts = [];
    for (const selector of selectors) {
      allPosts = feed.querySelectorAll(selector.query);
      console.log(`  ${selector.name}: ${allPosts.length} posts`);
      if (allPosts.length > 0) break;
    }
    
    // Fallback: large divs with many links
    if (allPosts.length === 0) {
      const allDivs = feed.querySelectorAll('div');
      allPosts = Array.from(allDivs).filter(div => 
        div.offsetHeight > 200 && div.querySelectorAll('a').length > 5
      );
      console.log(`  Fallback (size): ${allPosts.length} posts`);
    }
    
    if (allPosts.length === 0) {
      console.error("❌ No posts found!");
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: [],
        groupName: currentGroupName,
        error: "No posts found in feed"
      });
      return;
    }
    
    console.log(`Found ${allPosts.length} total posts`);
    
    const postsToday = [];
    
    allPosts.forEach((post, index) => {
      try {
        console.log(`\nPost #${index + 1}:`);
        
        // FILTRU UNIC: Verifică dacă postarea conține "caut"
        const keywordCheck = containsTransportKeywords(post);
        if (!keywordCheck.relevant) {
          return; // Skip post fără "caut"
        }
        
        // Extract info (best effort - dacă nu găsește, folosește fallback)
        const { postUrl, timeText } = extractPostInfo(post);
        
        // IMPORTANT: Dacă nu avem URL valid, SKIP această postare!
        if (!postUrl) {
          console.log(`  ⚠️ SKIPPING post - no valid URL found`);
          return;
        }
        
        // Dacă nu are timestamp, folosește "Acum"
        const finalTime = timeText || "Acum";
        
        // Extract ID din URL
        const postId = extractPostId(postUrl, post, index);
        const fullUrl = postUrl.startsWith('http') ? postUrl : 'https://www.facebook.com' + postUrl;
        
        postsToday.push({ 
          postId, 
          postUrl: fullUrl, 
          timeText: finalTime,
          service: keywordCheck.service,
          keyword: keywordCheck.keyword,
          postText: keywordCheck.postText || 'Fără text'
        });
        console.log(`  ✅ Added! ID: ${postId.slice(0, 30)}`);
        console.log(`  📝 Text: ${keywordCheck.postText?.substring(0, 60)}...`);
        
      } catch (err) {
        console.error(`  ❌ Error processing post #${index + 1}:`, err);
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`✅ Posts with "caut" keywords: ${postsToday.length}`);
    console.log(`📊 Total scanned: ${allPosts.length}`);
    console.log(`📍 Group: ${currentGroupName}`);
    console.log(`⏰ Time range: Last 12 hours`);
    
    // Send results
    if (postsToday.length > 0) {
      console.log("📤 Sending relevant posts to background...");
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: postsToday,
        groupName: currentGroupName
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Send error:", chrome.runtime.lastError.message);
        } else {
          console.log("✅ Response:", response);
        }
      });
    } else {
      console.warn("⚠️ No relevant posts found");
      console.log("ℹ️ Posts must contain 'caut' keyword and be from last 12 hours");
      chrome.runtime.sendMessage({ 
        type: "posts_from_today", 
        posts: [],
        groupName: currentGroupName
      });
    }
    
  } catch (err) {
    console.error("❌ Scan error:", err);
  }
} // End of scanFeed function

// EOF
