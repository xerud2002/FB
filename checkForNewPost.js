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
  // Găsește doar textul principal al postării, nu comentarii sau alte elemente
  const mainContent = postElement.querySelector('[data-ad-preview="message"]') || 
                      postElement.querySelector('[data-ad-comet-preview="message"]') ||
                      postElement.querySelector('div[dir="auto"]') ||
                      postElement;
  
  const text = (mainContent.textContent || '').toLowerCase();
  const originalText = (mainContent.textContent || '').trim();
  
  // Debug: Arată primele 100 caractere din text
  console.log(`  📝 Post text: "${text.substring(0, 100)}..."`);
  
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
  const allLinks = post.querySelectorAll('a');
  let postUrl = null;
  let timeText = '';
  
  console.log(`  📊 Total links found: ${allLinks.length}`);
  
  // METODA 1: Găsește ORICE URL cu pattern-uri cunoscute
  for (let i = 0; i < allLinks.length; i++) {
    const link = allLinks[i];
    const href = link.href || '';
    
    // Log primele 5 link-uri pentru debug
    if (i < 5) {
      console.log(`  Link ${i+1}: ${href.substring(0, 100)}...`);
    }
    
    // Pattern 1: Full Facebook group post URL
    if (href.match(/facebook\.com\/groups\/\d+\/posts\//)) {
      postUrl = href.split('?')[0]; // Remove query params
      console.log(`  ✅ Pattern 1 - Full group post URL`);
      break;
    }
    
    // Pattern 2: Permalink style
    if (href.match(/facebook\.com\/groups\/\d+\/permalink\//)) {
      postUrl = href.split('?')[0];
      console.log(`  ✅ Pattern 2 - Permalink style`);
      break;
    }
    
    // Pattern 3: story_fbid in URL
    if (href.includes('story_fbid=') && href.includes('facebook.com')) {
      postUrl = href;
      console.log(`  ✅ Pattern 3 - story_fbid URL`);
      break;
    }
    
    // Pattern 4: Relative URL starting with /groups/
    if (href.startsWith('/groups/') && href.includes('/posts/')) {
      postUrl = 'https://www.facebook.com' + href.split('?')[0];
      console.log(`  ✅ Pattern 4 - Relative URL`);
      break;
    }
    
    // Pattern 5: Any facebook.com URL with /posts/
    if (href.includes('facebook.com') && href.includes('/posts/')) {
      postUrl = href.split('?')[0];
      console.log(`  ✅ Pattern 5 - Any FB /posts/ URL`);
      break;
    }
  }
  
  // Log status after first pass
  if (!postUrl) {
    console.log(`  ⚠️ No permalink found in first pass (checked ${allLinks.length} links)`);
  }
  
  // PRIORITATE 2: Găsește timestamp (independent de permalink)
  for (const link of allLinks) {
    const text = (link.innerText || link.textContent || '').trim();
    const ariaLabel = link.getAttribute('aria-label') || '';
    
    // Match patterns: "2m", "5 min", "1h", "3 hours ago", etc.
    if (text.match(/^\d+\s*(s|sec|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|oră|ore|zi|zile)\s*(ago)?$/i)) {
      timeText = text.replace(/\s*ago\s*/i, '').trim();
      console.log(`  ⏰ Timestamp found: "${timeText}"`);
      break;
    }
    
    // Check aria-label
    if (!timeText && ariaLabel) {
      const ariaMatch = ariaLabel.match(/(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|week|min|m|h|s|sec|d|w|oră|ore|zi|zile)/i);
      if (ariaMatch) {
        timeText = ariaMatch[0];
        console.log(`  ⏰ Timestamp in aria-label: "${timeText}"`);
        break;
      }
    }
  }
  
  // FALLBACK 1: Caută timestamp în textul postării
  if (!timeText) {
    const postText = post.textContent || '';
    const timePatterns = [
      /(\d+)\s*s(?:ec)?(?:onds?)?\b/i,
      /(\d+)\s*m(?:in)?(?:ute)?(?:s)?\b/i,
      /(\d+)\s*h(?:r)?(?:our)?(?:s)?\b/i,
      /(\d+)\s*d(?:ay)?(?:s)?\b/i,
      /(\d+)\s*w(?:eek)?(?:s)?\b/i,
      /(\d+)\s*or[ăe]\b/i,
      /(\d+)\s*zi(?:le)?\b/i
    ];
    
    for (const pattern of timePatterns) {
      const match = postText.match(pattern);
      if (match) {
        timeText = match[0];
        console.log(`  ⏰ Timestamp in text: "${timeText}"`);
        break;
      }
    }
  }
  
  // FALLBACK 2: Caută ORICE link facebook.com care arată ca un post
  if (!postUrl) {
    console.log(`  🔍 FALLBACK 2: Searching all facebook.com links...`);
    for (const link of allLinks) {
      const href = link.href || '';
      if (href.includes('facebook.com') && (href.includes('/posts/') || href.includes('/permalink/') || href.includes('?__cft__'))) {
        postUrl = href;
        console.log(`  ✅ Found FB link: ${postUrl}`);
        break;
      }
    }
  }
  
  // FALLBACK 3: Construiește URL din HTML dacă nu s-a găsit
  if (!postUrl) {
    console.log(`  🔍 FALLBACK 3: Searching HTML for IDs...`);
    const postHtml = post.innerHTML || '';
    const storyMatch = postHtml.match(/story_fbid[=\/](\d+)/);
    const pfbidMatch = postHtml.match(/(pfbid[A-Za-z0-9]+)/);
    
    if (storyMatch || pfbidMatch) {
      const groupId = window.location.pathname.split('/')[2];
      const storyId = storyMatch ? storyMatch[1] : pfbidMatch[1];
      postUrl = `https://www.facebook.com/groups/${groupId}/posts/${storyId}/`;
      console.log(`  🔨 URL constructed from HTML: ${postUrl}`);
    } else {
      console.log(`  ❌ No story_fbid or pfbid found in HTML`);
    }
  }
  
  // FALLBACK 4: Dacă avem URL dar nu timestamp, acceptă ca "necunoscut"
  if (postUrl && !timeText) {
    timeText = "unknown";
    console.log(`  ⚠️ No timestamp found, using "unknown"`);
  }
  
  // Final check
  if (!postUrl) {
    console.log(`  ❌ FAILED: No permalink found after all fallbacks!`);
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
        
        // Dacă nu are URL, creează unul din group URL
        const finalUrl = postUrl || window.location.href;
        
        // Dacă nu are timestamp, folosește "Acum"
        const finalTime = timeText || "Acum";
        
        // Extract ID (garantat să existe)
        const postId = postUrl ? extractPostId(postUrl, post, index) : `post_${Date.now()}_${index}`;
        const fullUrl = finalUrl.startsWith('http') ? finalUrl : 'https://www.facebook.com' + finalUrl;
        
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
}
