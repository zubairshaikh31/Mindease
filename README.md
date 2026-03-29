# 🌿 MindEase Enhanced — HackToon 1.0 UPGRADED

## What's New (vs Original)

### 🎤 Full-Duplex Voice
- Browser SpeechRecognition auto-sends after speech
- Language-aware: switches to hi-IN for Hindi/Hinglish
- TTS auto-speaks every AI response (calm tone, 0.88 rate)
- Stop button to interrupt speech
- Visual "talking..." indicator with pulsing ring on avatar

### 📷 Face Emotion Detection
- face-api.js loaded from CDN (no install needed)
- TinyFaceDetector + FaceExpressionNet
- Runs every 1.5s, smoothed over 4 frames (no flicker)
- Toggle camera with 📷 button in header
- Face emotion fused with text emotion in backend

### 🌐 Multi-Language Intelligence
- Hindi (Devanagari) → responds in Hindi
- Hinglish (mixed) → responds in Hinglish  
- English → responds in English
- Language pill shown in header
- Speech recognition switches locale automatically

### 🧠 Emotion Fusion
- Text (50%) + Face (35%) + Voice (15%) weighted fusion
- MULTI-SIGNAL ✓ badge when camera + text agree
- Backend /api/fuse_emotion endpoint
- Boosted confidence when signals agree

### 📈 Mood Trend
- Bar chart in journal showing last 7 moods
- /api/mood_trend endpoint

### UI Enhancements
- Face camera panel in chat + detection tabs
- Speaking indicator in header
- Language badge
- Enhanced crisis: "Find Help Near Me" + "Alert Trusted Contact"
- Breathing circle with glow animation

## Setup (Same as Before)

```bash
# Backend
cd backend
pip install flask flask-cors requests
python app.py

# Frontend
cd frontend
npm install
npm start
```

## API (All Original Endpoints Preserved)
- GET  /api/health
- POST /api/chat         ← now accepts face_emotion, face_conf
- POST /api/analyze
- GET/POST /api/journal
- GET  /api/grounding
- POST /api/fuse_emotion ← NEW
- GET  /api/mood_trend   ← NEW

