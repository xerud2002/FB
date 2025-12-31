// Acest script se activează automat când deschizi o pagină de grup Facebook
// NU postează automat - tu dai click manual după ce textul e inserat!

chrome.storage.local.get("commentText", (data) => {
  if (!data.commentText) {
    console.log("Niciun comentariu pregătit.");
    return;
  }
  
  const interval = setInterval(() => {
    const commentBoxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');

    commentBoxes.forEach((box) => {
      const visible = box.offsetParent !== null;
      const label = box.closest('[aria-label]');
      const isCommentArea =
        (label?.getAttribute("aria-label") || "").toLowerCase().includes("comment") ||
        box.parentElement?.innerText?.toLowerCase().includes("answer");

      if (visible && isCommentArea) {
        console.log("✅ Comment box găsit:", box);

        // Focus și simulează typing (compatibil React)
        box.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(box);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        document.execCommand("insertText", false, data.commentText);

        console.log("✅ Comentariu inserat! TU dai click pe butonul Comment pentru a posta.");

        // NU mai dăm click automat - tu postezi manual!
        // Oprim scriptul după ce textul e inserat
        clearInterval(interval);
        
        // Curățăm storage-ul
        chrome.storage.local.remove("commentText");
      }
    });
  }, 1000);
});
