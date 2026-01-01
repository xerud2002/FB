// Facebook Group Post Scanner - Simplified & Robust
console.log(" checkForNewPost.js LOADED!");

let currentGroupName = "Unknown Group";

// Listen for group name
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "group_info") {
    currentGroupName = message.groupName;
    console.log(" Group:", currentGroupName);
    sendResponse({ status: "received" });
  }
  return true;
});

// Start scanning after page loads
setTimeout(() => {
  console.log("=== STARTING SCAN ===");
  console.log("URL:", window.location.href);
  
  // Small scroll to load content
  window.scrollTo(0, 1500);
  
  setTimeout(() => {
    window.scrollTo(0, 3000);
    
    setTimeout(() => {
      scanForPosts();
    }, 3000);
  }, 2000);
  
}, 5000); // Wait 5s for page load

function scanForPosts() {
  console.log(" Scanning for posts...");
  
  // Find all posts - Facebook uses role="article" for posts
  let posts = document.querySelectorAll('[role="article"]');
  console.log(`Found ${posts.length} articles`);
  
  // Fallback selectors
  if (posts.length === 0) {
    posts = document.querySelectorAll('[data-pagelet^="FeedUnit"]');
    console.log(`Fallback 1: ${posts.length} FeedUnits`);
  }
  
  if (posts.length === 0) {
    posts = document.querySelectorAll('[aria-posinset]');
    console.log(`Fallback 2: ${posts.length} posinset elements`);
  }
  
  // Limit to first 20 posts
  const postsArray = Array.from(posts).slice(0, 20);
  console.log(`Processing ${postsArray.length} posts`);
  
  const foundPosts = [];
  
  postsArray.forEach((post, index) => {
    console.log(`\n--- Post #${index + 1} ---`);
    
    // Get ALL text content from the post
    const fullText = post.textContent || "";
    
    // Check if contains "caut"
    if (fullText.toLowerCase().includes("caut")) {
      console.log(" Contains 'caut'!");
      
      // Extract the actual post text (longest text block)
      const postText = extractPostText(post);
      console.log(" Text:", postText.substring(0, 100) + "...");
      
      // Extract URL
      const postUrl = extractPostUrl(post);
      console.log(" URL:", postUrl || "NOT FOUND");
      
      // Extract time
      const timeText = extractTimeText(post);
      console.log(" Time:", timeText);
      
      if (postUrl) {
        foundPosts.push({
          postId: generatePostId(postUrl, index),
          postUrl: postUrl,
          timeText: timeText,
          postText: postText.substring(0, 250),
          keyword: "caut"
        });
        console.log(" POST ADDED!");
      } else {
        console.log(" Skipped - no valid URL");
      }
    } else {
      console.log(" No 'caut' keyword");
    }
  });
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Found ${foundPosts.length} relevant posts`);
  
  // Send to background
  chrome.runtime.sendMessage({
    type: "posts_from_today",
    posts: foundPosts,
    groupName: currentGroupName
  }, (response) => {
    console.log(" Sent to background:", response);
  });
}

// Extract readable text from post
function extractPostText(post) {
  // Find all text containers
  const textElements = post.querySelectorAll("div[dir=\"auto\"], span[dir=\"auto\"]");
  
  let longestText = "";
  
  textElements.forEach(el => {
    const text = (el.textContent || "").trim();
    
    // Skip short text and UI elements
    if (text.length < 20) return;
    if (text.match(/^(Like|Comment|Share|Follow|See more|Vezi mai mult|\d+ comments?|\d+ likes?)$/i)) return;
    
    // Skip if inside a button or link that is short
    if (el.closest("[role=\"button\"]") && text.length < 50) return;
    
    if (text.length > longestText.length) {
      longestText = text;
    }
  });
  
  // Clean up
  longestText = longestText.replace(/\s+/g, " ").trim();
  
  return longestText || post.textContent.substring(0, 200);
}

// Extract post URL
function extractPostUrl(post) {
  const links = post.querySelectorAll("a[href]");
  
  for (const link of links) {
    const href = link.href || "";
    const text = (link.textContent || "").trim();
    
    // Time links are usually post permalinks
    if (text.match(/^\d+[mhd]$|^\d+\s*(min|hour|ora|ore|zi)/i)) {
      if (href.includes("facebook.com")) {
        return href.split("?")[0];
      }
    }
    
    // Direct post URLs
    if (href.match(/facebook\.com\/groups\/\d+\/(posts|permalink)\/\d+/)) {
      return href.split("?")[0];
    }
    
    if (href.includes("/posts/") || href.includes("/permalink/")) {
      return href.split("?")[0];
    }
  }
  
  // Fallback: construct from group URL + any post ID found
  const groupMatch = window.location.href.match(/groups\/(\d+)/);
  if (groupMatch) {
    const postIdMatch = post.innerHTML.match(/posts\/(\d{10,})/);
    if (postIdMatch) {
      return `https://www.facebook.com/groups/${groupMatch[1]}/posts/${postIdMatch[1]}/`;
    }
  }
  
  return null;
}

// Extract time text
function extractTimeText(post) {
  const links = post.querySelectorAll("a");
  
  for (const link of links) {
    const text = (link.textContent || "").trim();
    
    // Match time patterns
    if (text.match(/^\d+[smhd]$/i)) return text;
    if (text.match(/^\d+\s*(sec|min|hour|ora|ore|zi|zile|day)/i)) return text;
    if (text.match(/^(just now|acum|yesterday|ieri)/i)) return text;
  }
  
  return "Acum";
}

// Generate unique post ID
function generatePostId(url, index) {
  const match = url.match(/\/(\d{10,})\/?/);
  if (match) return match[1];
  return `post_${Date.now()}_${index}`;
}
