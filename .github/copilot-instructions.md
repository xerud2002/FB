# Facebook Group Assistant - Copilot Instructions

## Project Overview
This is a Chrome/Edge extension (Manifest V3) that automates Facebook group interactions. It monitors a specific Facebook group for new posts, generates AI-powered comments using OpenAI's API, and automatically posts them.

## Architecture & Data Flow

### Three-Part Extension Architecture
1. **Background Service Worker** ([background.js](background.js))
   - Creates alarm to check group every 5 minutes
   - Opens group URL in background tab, injects `checkForNewPost.js`, closes tab after 15s
   - Listens for post detection messages and shows desktop notification when new post found
   - Stores `lastPostId` to prevent duplicate notifications

2. **Content Script** ([content.js](content.js))
   - Injected automatically on `*://www.facebook.com/groups/*` pages
   - Retrieves stored comment text from `chrome.storage.local`
   - Uses interval polling to find comment boxes: `[contenteditable="true"][role="textbox"]`
   - Simulates typing via `document.execCommand("insertText")` for React compatibility
   - Auto-clicks Facebook's `div[role="button"][aria-label="Comment"]` after 500ms delay

3. **Popup UI** ([popup.html](popup.html) + [popup.js](popup.js))
   - Dropdown to select target Facebook group
   - Prompt type selector (review request vs. verification reminder)
   - Calls OpenAI API (gpt-3.5-turbo) to generate short comments (15-20 words)
   - Always ensures "daiostea.ro" link is included
   - Stores generated comment in `chrome.storage.local` and opens group in new tab

### Critical Workflow
```
User clicks "Genereaza" → OpenAI generates comment → User clicks "Posteaza" 
→ Comment stored + new tab opens → content.js detects comment box → Auto-types and submits
```

## Facebook DOM Interaction Patterns

### Comment Box Detection
Facebook uses dynamic React-rendered elements. Target elements by:
- `[contenteditable="true"][role="textbox"]` for input areas
- Check `offsetParent !== null` to ensure visibility
- Verify parent has `aria-label` containing "comment" (case-insensitive)

### Typing Simulation (React-Compatible)
```javascript
box.focus();
const sel = window.getSelection();
const range = document.createRange();
range.selectNodeContents(box);
range.collapse(false);
sel.removeAllRanges();
sel.addRange(range);
document.execCommand("insertText", false, text);
```
**Don't** use `box.innerText = text` - React won't detect changes.

### Submit Button
Use `div[role="button"][aria-label="Comment"]` with 500ms delay after typing.

## Key Files & Responsibilities

- **[manifest.json](manifest.json)**: Permissions (`tabs`, `scripting`, `storage`), content script matching
- **[checkForNewPost.js](checkForNewPost.js)**: Injected script that extracts first post ID from feed after 5s wait
- **[API Chat.txt](API%20Chat.txt)**: Stores OpenAI API key (🚨 **SECURITY ISSUE** - see below)

## Known Issues & Conventions

### Security Concern
OpenAI API key is hardcoded in [popup.js](popup.js) line 18. **Never commit to public repos**. Consider:
- Using environment variables with build tool (e.g., `chrome.runtime.getManifest().oauth2`)
- Proxying requests through your own backend

### Romanian Language
UI and generated comments are in Romanian ("Scrie un comentariu scurt..."). Maintain this when modifying prompts.

### Timing Dependencies
- `checkForNewPost.js` waits 5 seconds for page load before extracting post
- `content.js` waits 500ms after typing before clicking submit button
- Background tab closes after 15 seconds (ensure script completes first)

## Extension Development Workflow

### Testing Locally
1. Load extension: `chrome://extensions` → Enable Developer Mode → "Load unpacked" → Select `c:\Users\Cip\Desktop\FB`
2. Test popup: Click extension icon
3. Test content script: Open any Facebook group page, check console logs
4. Test background: Check `chrome://serviceworker-internals` for logs

### No Build Process
This is vanilla JavaScript - no bundler/transpiler. Edit files directly and reload extension.

## Adding Features

### New Prompt Types
1. Add option to [popup.html](popup.html) `<select id="promptType">`
2. Add corresponding case in [popup.js](popup.js) around line 25
3. Ensure prompt stays under max_tokens: 100 (15-20 word target)

### Multiple Groups
Groups array in [popup.js](popup.js) line 6-9. Add more objects with `name` and `url` properties.

### Different Monitoring Intervals
Change `periodInMinutes` in [background.js](background.js) line 4 (`chrome.alarms.create`).
