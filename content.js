console.log("[CS] LOADED");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "scan_now") {
    doScan(msg.groupName).then(r => sendResponse({posts: r}));
    return true;
  }
  if (msg.type === "type_comment") {
    const box = document.querySelector('[contenteditable="true"][role="textbox"]');
    if (box) { box.focus(); document.execCommand("insertText", false, msg.text); }
    sendResponse({ok: true});
  }
});

async function doScan(groupName) {
  for (let i = 0; i < 5; i++) { window.scrollBy(0, 1000); await sleep(1000); }
  await sleep(2000);
  
  const links = document.querySelectorAll('a[href*="/groups/1784041808422081/posts/"]');
  console.log("[CS] Links:", links.length);
  
  const results = [];
  const seen = new Set();
  
  links.forEach(link => {
    const href = link.href;
    const clean = href.split("?")[0];
    if (seen.has(clean)) return;
    seen.add(clean);
    
    const article = link.closest('[role="article"]');
    results.push({
      postId: clean.split("/posts/")[1] || ("p" + Date.now()),
      postUrl: clean,
      postText: article ? article.innerText.substring(0, 200) : "",
      timeText: "recent",
      keyword: "found",
      groupName: groupName
    });
    console.log("[CS] +", clean);
  });
  
  console.log("[CS] Results:", results.length);
  if (results.length) chrome.runtime.sendMessage({type: "scan_results", posts: results});
  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
