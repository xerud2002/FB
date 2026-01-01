# Facebook Extension - Debug Guide

## ✅ Issues Fixed

### 1. **Post Detection Timing** 
- **Before**: checkForNewPost.js waited 10s, but tab closed after 15s (too tight)
- **After**: Script waits 8s, tab closes after 20s (12s buffer for safety)

### 2. **Time Parsing Logic**
- **Before**: Strict regex patterns that missed "2 minutes ago" or "seconds" formats
- **After**: Flexible matching for "seconds", "minutes ago", "1 hour ago", Romanian variants
- **Before**: Minutes had to be < 60 (missed 59 minutes)
- **After**: Minutes must be <= 59 (includes last minute of the hour)

### 3. **Debug Mode Removed**
- **Before**: When no posts passed time filter, ALL posts were sent (defeating the purpose)
- **After**: Only posts from last hour are sent, with clear logging if none found

### 4. **Comment Insertion**
- **Before**: Stopped after first comment box found, no feedback
- **After**: 
  - Checks if box is empty before inserting
  - Visual notification when text inserted
  - Green border highlight on comment box
  - Max 30 attempts with timeout handling
  - Better React compatibility with InputEvent fallback

### 5. **Error Handling**
- **Before**: Silent failures, hard to debug
- **After**: 
  - Feed not found → sends error message to background
  - No posts → sends empty array with explanation
  - Script injection errors → logged with context
  - Comment timeout → user notification

## 🔍 How to Debug

### Check Background Worker
1. Open `chrome://extensions`
2. Find "Facebook Group Post Assistant"
3. Click "service worker" → Opens DevTools
4. Look for:
   - `[checkGroup]` logs showing tab creation
   - `[POSTS]` logs showing received posts
   - Error messages

### Check Content Script (checkForNewPost.js)
1. When background opens hidden tab, you won't see it
2. Check background worker logs for:
   ```
   [checkGroup] ✅ Script injected successfully
   ```
3. In the injected script console (if accessible):
   - `🚀 checkForNewPost.js LOADED!`
   - `Found X total posts in feed`
   - `✅ Added post #N` for each detected post

### Check Comment Insertion (content.js)
1. After clicking "🚀 Deschide & Postează" in popup
2. New tab opens with the post
3. Check console (F12):
   - `🚀 Content script loaded on: https://...`
   - `📝 Comentariu de inserat: ...`
   - `⏳ Încercare X/30: Aștept comment box...`
   - `✅ Comment box găsit și gol!`
   - `✅ Comentariu inserat cu succes!`
4. Look for green notification top-right
5. Comment box should have green border

### Common Issues

#### "No posts from last hour found"
**Causes**:
- Group has no new posts
- Posts are older than 1 hour
- Facebook changed time format

**Debug**:
1. Check console: `Total posts scanned: X`
2. If X = 0: Feed selector changed (Facebook update)
3. If X > 0: Check `⏰ Checking time:` logs
4. Verify time text matches patterns in code

#### "Comment box not found"
**Causes**:
- Page still loading
- Wrong page type (not a post)
- Facebook changed selectors

**Debug**:
1. Check `⏳ Încercare X/30` messages
2. If reaches 30: Selector changed or wrong page
3. Manually inspect page: Look for `[contenteditable="true"][role="textbox"]`
4. Check `aria-label` contains "comment" or "write"

#### "Tab closes too fast"
**Causes**:
- Slow internet
- Facebook takes longer to load

**Fix**:
In [background.js](background.js) line ~82, increase timeout:
```javascript
}, 25000); // Increase from 20000 to 25000 (25 seconds)
```

## 🧪 Testing Workflow

### Test Post Detection
1. Open extension popup
2. Click "🔄 Verifică Acum Toate Grupurile"
3. Wait 20-30 seconds
4. Check popup for "Postări Detectate" section
5. If no posts appear:
   - Check background worker console
   - Look for error messages
   - Verify group URL is correct

### Test Comment Insertion
1. Ensure posts are detected in popup
2. Click "🚀 Deschide & Postează" on a post
3. New tab opens
4. Watch for:
   - Green notification top-right
   - Comment text appears in box
   - Green border on box
5. Manually click "Comment" button

### Test Full Workflow
1. Make a test post in the Facebook group
2. Wait 5 minutes (or click manual check)
3. Post should appear in popup
4. Click to open and comment
5. Comment text auto-fills
6. Click "Comment" to post

## 📊 Timing Diagram

```
Background Worker:
│
├─ Create hidden tab ────────────────── 0s
│
├─ Wait 2s ──────────────────────────── 2s
│
├─ Inject checkForNewPost.js ─────────── 2s
│
│  Content Script (checkForNewPost.js):
│  ├─ Wait 8s for page load ──────────── 10s
│  ├─ Scan posts ─────────────────────── 11s
│  └─ Send results to background ────── 12s
│
└─ Close tab ────────────────────────── 20s
```

Total: 20 seconds per group check
Safety buffer: 8 seconds (20s - 12s)

## 🛠️ Manual Testing URLs

Test with these scenarios:

1. **Fresh post (< 5 minutes old)**
   - Should be detected ✅
   
2. **30-minute old post**
   - Should be detected ✅
   
3. **59-minute old post**
   - Should be detected ✅
   
4. **61-minute old post**
   - Should NOT be detected ❌
   
5. **2-hour old post**
   - Should NOT be detected ❌

## 🔐 Security Note

**API KEY WARNING**: OpenAI API key might be exposed in popup.js
- Do NOT commit to public repositories
- Consider moving to environment variables
- Or proxy through your own backend

## 📝 Maintenance

If Facebook changes their DOM structure, update selectors in:

1. **checkForNewPost.js** (line ~25-30)
   ```javascript
   const feed = document.querySelector('[role="feed"]');
   let allPosts = feed.querySelectorAll('div[data-pagelet^="FeedUnit"]');
   ```

2. **content.js** (line ~21)
   ```javascript
   const commentBoxes = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
   ```

To find new selectors:
1. Open Facebook in browser
2. Press F12 (DevTools)
3. Click "Select element" tool
4. Click on the element you want to find
5. Look at the HTML in Elements panel
6. Find unique attributes (`role`, `data-*`, `aria-label`)
