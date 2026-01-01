const express = require('express');
const path = require('path');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// VAPID Keys pentru Push Notifications
// Generează cu: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: 'BJONp8h8U6zQVnCrB3kEih2F5gcys7hpCEai7FPrT1ik9cin_BXZmajFy-lhYYKDSBYZHiT1RUvwkOToc8HT6-w',
  privateKey: 'ePSa5oxdl_JoMdFqFUljGkrxG-J11Qtc6kbU-NLWN58'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory storage (folosește database în producție)
let subscriptions = [];
let detectedPosts = [];

// === API ENDPOINTS ===

// Subscribe to push notifications
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  console.log('✅ New subscription:', subscription.endpoint);
  res.status(201).json({ success: true });
});

// Get detected posts
app.get('/api/posts', (req, res) => {
  res.json({
    success: true,
    posts: detectedPosts,
    count: detectedPosts.length
  });
});

// Add new post (simulare - în realitate vine din scraper)
app.post('/api/posts', (req, res) => {
  const post = req.body;
  detectedPosts.push(post);
  
  console.log('📬 New post detected:', post);
  
  // Trimite notificare push tuturor subscribed users
  sendPushNotification({
    title: '🚚 Postare Nouă Detectată!',
    body: `${post.service || 'Transport'} - ${post.timeText || 'Acum'}`,
    url: post.postUrl
  });
  
  res.status(201).json({ success: true });
});

// Clear posts
app.delete('/api/posts', (req, res) => {
  detectedPosts = [];
  res.json({ success: true, message: 'Posts cleared' });
});

// Send push notification
async function sendPushNotification(data) {
  const payload = JSON.stringify(data);
  
  const promises = subscriptions.map(subscription => {
    return webpush.sendNotification(subscription, payload)
      .catch(err => {
        console.error('❌ Push failed:', err);
        // Remove invalid subscriptions
        subscriptions = subscriptions.filter(sub => sub !== subscription);
      });
  });
  
  await Promise.all(promises);
  console.log(`✅ Push sent to ${subscriptions.length} subscribers`);
}

// === FACEBOOK SCRAPER SIMULATION ===
// În realitate, aici ai rula checkForNewPost.js logic

function simulateFacebookScraper() {
  // Verifică la fiecare 5 minute
  setInterval(async () => {
    console.log('🔍 Checking Facebook groups...');
    
    // AICI: Implementează logica de scraping Facebook
    // Pentru demo, adaugă postare fake
    const fakePost = {
      postId: `post_${Date.now()}`,
      postUrl: 'https://www.facebook.com/groups/1784041808422081/',
      timeText: '2h',
      service: 'Transport Mobila',
      keyword: 'transport mobila',
      timestamp: Date.now()
    };
    
    // Detectează postare "nouă" (doar pentru demo)
    if (Math.random() > 0.7) {
      detectedPosts.push(fakePost);
      
      await sendPushNotification({
        title: '🚚 Postare Nouă Detectată!',
        body: `${fakePost.service} - ${fakePost.timeText}`,
        url: fakePost.postUrl
      });
    }
  }, 5 * 60 * 1000); // 5 minute
}

// Start scraper simulation
// simulateFacebookScraper();

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🚚 Curierul Perfect PWA Server      ║
║  📱 Running on: http://localhost:${PORT}  ║
║  ✅ Ready for mobile access!         ║
╚═══════════════════════════════════════╝
  `);
  
  console.log('\n📱 Access from mobile:');
  console.log('   1. Open http://YOUR_LOCAL_IP:3000 in mobile browser');
  console.log('   2. Click "Install" when prompted');
  console.log('   3. Enable notifications\n');
});
