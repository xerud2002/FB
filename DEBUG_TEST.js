// ==============================================================
// DEBUG TEST - Run this in Facebook group page console
// ==============================================================
// Instructions:
// 1. Go to: https://www.facebook.com/groups/1784041808422081
// 2. Open Console (F12)
// 3. Copy-paste this entire file
// 4. Press Enter
// ==============================================================

console.log("🔍 ===== FB POST DEBUG TEST =====");

// Find feed
const feed = document.querySelector('[role="feed"]');
console.log("1. Feed found:", !!feed);

if (!feed) {
  console.error("❌ No feed found! Extension cannot work.");
} else {
  // Try different selectors
  const selector1 = feed.querySelectorAll('div[data-pagelet^="FeedUnit"]');
  const selector2 = feed.querySelectorAll('div[aria-posinset]');
  const selector3 = feed.querySelectorAll('div[role="article"]');
  
  console.log("2. Selector results:");
  console.log(`   data-pagelet: ${selector1.length} posts`);
  console.log(`   aria-posinset: ${selector2.length} posts`);
  console.log(`   role=article: ${selector3.length} posts`);
  
  // Use whichever selector found posts
  const posts = selector1.length > 0 ? selector1 : 
                selector2.length > 0 ? selector2 : 
                selector3.length > 0 ? selector3 : [];
  
  if (posts.length === 0) {
    console.error("❌ No posts found with any selector!");
  } else {
    console.log(`\n3. Analyzing first post (of ${posts.length} total):`);
    const firstPost = posts[0];
    const links = firstPost.querySelectorAll('a');
    
    console.log(`   Total links in post: ${links.length}`);
    
    // Show first 10 links
    console.log("\n4. First 10 link URLs:");
    for (let i = 0; i < Math.min(10, links.length); i++) {
      const link = links[i];
      const href = link.href || '';
      const text = (link.innerText || link.textContent || '').trim();
      
      console.log(`   Link ${i+1}:`);
      console.log(`      Text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
      console.log(`      URL: ${href.substring(0, 100)}${href.length > 100 ? '...' : ''}`);
      
      // Check if it looks like a permalink
      if (href.includes('/groups/') && href.includes('/posts/')) {
        console.log(`      ✅ THIS IS A PERMALINK!`);
      } else if (href.includes('/posts/')) {
        console.log(`      ⚠️ Has /posts/ but not /groups/`);
      } else if (href.includes('/permalink/')) {
        console.log(`      ✅ THIS IS A PERMALINK (older style)!`);
      } else if (href.includes('story_fbid')) {
        console.log(`      ✅ THIS IS A PERMALINK (story_fbid)!`);
      }
    }
    
    // Search HTML for IDs
    console.log("\n5. Searching post HTML for IDs:");
    const html = firstPost.innerHTML;
    const storyMatch = html.match(/story_fbid[=\/](\d+)/);
    const pfbidMatch = html.match(/(pfbid[A-Za-z0-9]+)/);
    
    if (storyMatch) {
      console.log(`   ✅ Found story_fbid: ${storyMatch[1]}`);
      const groupId = window.location.pathname.split('/')[2];
      console.log(`   📝 Can construct: https://www.facebook.com/groups/${groupId}/posts/${storyMatch[1]}/`);
    } else {
      console.log(`   ❌ No story_fbid found`);
    }
    
    if (pfbidMatch) {
      console.log(`   ✅ Found pfbid: ${pfbidMatch[1]}`);
      const groupId = window.location.pathname.split('/')[2];
      console.log(`   📝 Can construct: https://www.facebook.com/groups/${groupId}/posts/${pfbidMatch[1]}/`);
    } else {
      console.log(`   ❌ No pfbid found`);
    }
    
    // Check post structure
    console.log("\n6. Post element structure:");
    console.log(`   ID: ${firstPost.id || '(none)'}`);
    console.log(`   data-ad-preview: ${firstPost.getAttribute('data-ad-preview') || '(none)'}`);
    console.log(`   aria-posinset: ${firstPost.getAttribute('aria-posinset') || '(none)'}`);
    console.log(`   data-pagelet: ${firstPost.getAttribute('data-pagelet') || '(none)'}`);
  }
}

console.log("\n🔍 ===== END DEBUG TEST =====");
console.log("\n📋 Next steps:");
console.log("   1. Check if permalinks were found above");
console.log("   2. If NO permalinks found, Facebook may have changed structure");
console.log("   3. If permalinks exist but extension doesn't find them, check the pattern matching");
