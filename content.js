// Optimized comment insertion script
console.log("🚀 Content script loaded:", window.location.href);

const MAX_ATTEMPTS = 30; // 30 seconds max
let commentInserted = false;
let attemptCount = 0;

chrome.storage.local.get("commentText", (data) => {
  if (!data.commentText) {
    console.log("ℹ️ No comment text prepared");
    return;
  }
  
  const commentText = data.commentText;
  console.log("📝 Comment to insert:", commentText.substring(0, 50) + "...");
  
  const interval = setInterval(() => {
    attemptCount++;
    
    if (attemptCount > MAX_ATTEMPTS) {
      console.error("❌ Timeout after 30 seconds!");
      clearInterval(interval);
      showNotification("❌ Comment box not found! Post manually.", "error");
      chrome.storage.local.remove("commentText");
      return;
    }
    
    const commentBoxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
    
    if (commentBoxes.length === 0) {
      if (attemptCount % 5 === 0) {
        console.log(`⏳ Attempt ${attemptCount}/${MAX_ATTEMPTS}...`);
      }
      return;
    }

    for (const box of commentBoxes) {
      // Check visibility
      if (box.offsetParent === null) continue;
      
      // Check if it's a comment box
      const parent = box.closest('[aria-label]');
      const ariaLabel = (parent?.getAttribute("aria-label") || "").toLowerCase();
      const boxLabel = (box.getAttribute("aria-label") || "").toLowerCase();
      
      const isCommentBox = 
        ariaLabel.includes("comment") || 
        ariaLabel.includes("write") ||
        ariaLabel.includes("scrie") ||
        boxLabel.includes("comment");
      
      // Check if empty
      const isEmpty = !box.textContent || box.textContent.trim() === "";
      
      if (isCommentBox && isEmpty && !commentInserted) {
        console.log("✅ Comment box found!");
        insertComment(box, commentText);
        commentInserted = true;
        clearInterval(interval);
        chrome.storage.local.remove("commentText");
        return;
      }
    }
  }, 1000);
});

// Helper: Insert comment with React compatibility
function insertComment(box, text) {
  box.focus();
  box.click();
  
  setTimeout(() => {
    try {
      // Method 1: execCommand (React compatible)
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      
      const success = document.execCommand("insertText", false, text);
      
      if (!success) {
        // Method 2: InputEvent fallback
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        });
        box.textContent = text;
        box.dispatchEvent(inputEvent);
      }
      
      // Trigger React onChange
      box.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log("✅ Comment inserted!");
      console.log("👉 Click 'Comment' button to post!");
      
      showNotification("✅ Comment inserted! Click 'Comment' to post.", "success");
      
      // Visual feedback
      box.style.border = "3px solid #4CAF50";
      box.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.5)";
      setTimeout(() => {
        box.style.border = "";
        box.style.boxShadow = "";
      }, 5000);
      
    } catch (err) {
      console.error("❌ Insert error:", err);
      showNotification("❌ Insert error! Post manually.", "error");
    }
  }, 300);
}

// Helper: Show in-page notification
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
