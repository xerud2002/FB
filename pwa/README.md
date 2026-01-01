# 📱 Curierul Perfect - PWA Mobile Version

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd pwa
npm install express web-push
```

### 2. Generate VAPID Keys (for Push Notifications)

```bash
npx web-push generate-vapid-keys
```

Copy the keys and paste them in `server.js`:
```javascript
const vapidKeys = {
  publicKey: 'YOUR_PUBLIC_KEY_HERE',
  privateKey: 'YOUR_PRIVATE_KEY_HERE'
};
```

Also update `app.js` line 63:
```javascript
applicationServerKey: urlBase64ToUint8Array('YOUR_PUBLIC_KEY_HERE')
```

### 3. Start Server

```bash
node server.js
```

Server will run on `http://localhost:3000`

---

## 📱 Access from Mobile

### Option 1: Local Network (Same WiFi)

1. Find your computer's local IP:
   ```bash
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```
   Look for: `192.168.x.x`

2. Open on mobile browser:
   ```
   http://192.168.x.x:3000
   ```

3. Click **"Install"** when prompted

### Option 2: Deploy to Cloud (Production)

Deploy to:
- **Heroku**: Free tier, easy deployment
- **Vercel**: Free, automatic HTTPS
- **Railway**: Free, Docker support
- **DigitalOcean**: $5/month droplet

---

## 🔧 Features

✅ **Installable** - Add to home screen  
✅ **Offline** - Works without internet (cached)  
✅ **Push Notifications** - Real-time alerts  
✅ **Responsive** - Optimized for mobile  
✅ **Fast** - Service Worker caching  

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Get all detected posts |
| POST | `/api/posts` | Add new post (from scraper) |
| DELETE | `/api/posts` | Clear all posts |
| POST | `/api/subscribe` | Subscribe to push notifications |

---

## 🔐 Security Notes

⚠️ **Important for Production:**

1. **HTTPS Required** - PWA requires HTTPS (except localhost)
2. **Facebook Scraping** - Use official Facebook Graph API
3. **Authentication** - Add user login/password
4. **Rate Limiting** - Prevent abuse
5. **Database** - Use MongoDB/PostgreSQL instead of in-memory

---

## 📦 Project Structure

```
pwa/
├── index.html          # Main mobile UI
├── app.js              # Frontend logic
├── service-worker.js   # PWA offline & push
├── manifest.json       # PWA config
├── server.js           # Backend API
└── README.md           # This file
```

---

## 🚀 Quick Deploy to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create curierul-perfect

# Add Procfile
echo "web: node server.js" > Procfile

# Deploy
git add .
git commit -m "PWA version"
git push heroku main

# Open app
heroku open
```

Your PWA will be live at: `https://curierul-perfect.herokuapp.com`

---

## 📝 TODO

- [ ] Integrate real Facebook scraping (Graph API)
- [ ] Add user authentication
- [ ] Database for posts (MongoDB)
- [ ] Admin panel for management
- [ ] Multi-group support
- [ ] Comment templates
- [ ] Analytics dashboard

---

## 🐛 Troubleshooting

**Push notifications not working?**
- Check VAPID keys are correct
- Ensure HTTPS (required for push)
- Enable notifications in mobile settings

**Can't install PWA?**
- Use Chrome/Edge browser on mobile
- HTTPS required (or localhost)
- Check manifest.json is valid

**Server not accessible from mobile?**
- Check firewall allows port 3000
- Ensure same WiFi network
- Try `0.0.0.0` instead of `localhost`

---

## 📧 Contact

For issues or questions, check the main repository README.

---

**Made with ❤️ for Curierul Perfect**
