import { useState, useRef, useEffect, useCallback } from 'react';

// ─── SESSION ──────────────────────────────────────────────────────────────────
const SID = 'me_' + Math.random().toString(36).slice(2,9);

// ─── MOOD THEMES (UNCHANGED) ──────────────────────────────────────────────────
const THEME = {
  crisis:  { bg:'#0d0404', surface:'#180808', card:'#1f0b0b', accent:'#ff4f4f', dim:'#ff4f4f22', glow:'#ff4f4f08', muted:'#ff8080', label:'Crisis',  emoji:'🆘' },
  sad:     { bg:'#04060f', surface:'#080e1c', card:'#0c1428', accent:'#5f96ff', dim:'#5f96ff22', glow:'#5f96ff08', muted:'#8ab4ff', label:'Sad',     emoji:'💙' },
  anxious: { bg:'#0a0614', surface:'#120e22', card:'#181430', accent:'#b49aff', dim:'#b49aff22', glow:'#b49aff08', muted:'#cbb8ff', label:'Anxious', emoji:'💜' },
  angry:   { bg:'#0f0600', surface:'#1a0e04', card:'#221208', accent:'#ff8c3a', dim:'#ff8c3a22', glow:'#ff8c3a08', muted:'#ffaa70', label:'Angry',   emoji:'🔥' },
  neutral: { bg:'#040a0f', surface:'#08121a', card:'#0c1924', accent:'#4eb8d4', dim:'#4eb8d422', glow:'#4eb8d408', muted:'#7acfe8', label:'Neutral', emoji:'🌊' },
  good:    { bg:'#030e07', surface:'#071610', card:'#0b1e14', accent:'#4ed48a', dim:'#4ed48a22', glow:'#4ed48a08', muted:'#76e8a6', label:'Good',    emoji:'🌿' },
};

const EMOTIONS = Object.keys(THEME);
const fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
function clamp(min,vw,max){ return `clamp(${min}px,${vw}vw,${max}px)`; }

// ─── ENHANCED VOICE HOOK — Full Duplex with auto-detect language ──────────────
function useVoice(onResult, language='en-IN') {
  const [on, setOn] = useState(false);
  const [transcript, setTranscript] = useState('');
  const ok = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const ref = useRef(null);
  const langRef = useRef(language);
  useEffect(()=>{ langRef.current = language; },[language]);

  const start = useCallback(() => {
    if (!ok) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = langRef.current;
    r.continuous = false;
    r.interimResults = true;
    r.onresult = e => {
      const t = Array.from(e.results).map(x=>x[0].transcript).join('');
      setTranscript(t);
      if (e.results[e.results.length-1].isFinal) {
        onResult(t);
        setTranscript('');
        setOn(false);
      }
    };
    r.onerror = () => { setOn(false); setTranscript(''); };
    r.onend   = () => { setOn(false); setTranscript(''); };
    ref.current = r;
    r.start();
    setOn(true);
  },[ok, onResult]);

  const stop = useCallback(() => {
    ref.current?.stop();
    setOn(false);
    setTranscript('');
  },[]);

  return { on, ok, start, stop, transcript };
}

// ─── TTS — calm, supportive, language-aware ────────────────────────────────────
let ttsUtterance = null;
function tts(text, lang='en-IN', onStart, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[🌿💙💜🔥🌊🆘⚠️📓🧘🌬️💨🖐️🧊✍️📱💧🌟🎯💌📈🚶🎵🤗💨🏃⏸️📞💬🆘🏥]/g,'').slice(0,350);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang; u.rate = 0.88; u.pitch = 1.05; u.volume = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const langCode = lang.split('-')[0];
  const pref = voices.find(v=>v.lang===lang && v.name.toLowerCase().includes('female'))
            || voices.find(v=>v.lang.startsWith(langCode))
            || voices.find(v=>v.name.toLowerCase().includes('female'))
            || voices[0];
  if(pref) u.voice = pref;
  if(onStart) u.onstart = onStart;
  if(onEnd)   u.onend   = onEnd;
  ttsUtterance = u;
  window.speechSynthesis.speak(u);
}
function stopTTS() { window.speechSynthesis?.cancel(); }

// ─── FACE EMOTION CAMERA HOOK (face-api.js) ───────────────────────────────────
function useFaceEmotion(active) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const historyRef  = useRef([]);
  const [faceEmotion, setFaceEmotion] = useState(null);
  const [faceConf,    setFaceConf]    = useState(0);
  const [camReady,    setCamReady]    = useState(false);
  const [faceApiReady,setFaceApiReady]= useState(false);
  const [camError,    setCamError]    = useState(null);

  // FIX 1: Load face-api models — local /models first, CDN fallback
  // Folder structure required: public/models/tiny_face_detector/ + public/models/face_expression/
  useEffect(() => {
    const loadModels = async (faceapi) => {
      const LOCAL = '/models';
      const CDN   = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
      let ok = false;
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL),
          faceapi.nets.faceExpressionNet.loadFromUri(LOCAL),
        ]);
        console.log('[FaceAPI] Models loaded from /models (local)');
        ok = true;
      } catch(e1) {
        console.warn('[FaceAPI] /models failed, trying CDN...', e1.message);
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(CDN),
            faceapi.nets.faceExpressionNet.loadFromUri(CDN),
          ]);
          console.log('[FaceAPI] Models loaded from CDN fallback');
          ok = true;
        } catch(e2) { console.warn('[FaceAPI] CDN fallback also failed:', e2.message); }
      }
      if (ok) setFaceApiReady(true);
    };

    if (window.faceapi) { loadModels(window.faceapi); return; }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.onload = () => { if (window.faceapi) loadModels(window.faceapi); };
    script.onerror = () => console.warn('[FaceAPI] Script load failed — face detection disabled');
    document.head.appendChild(script);
  },[]);

  // Start/stop camera
  useEffect(() => {
    if (!active) {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCamReady(false); setCamError(null);
      return;
    }
    navigator.mediaDevices?.getUserMedia({video:{width:320,height:240,facingMode:'user'}})
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setCamReady(true); setCamError(null);
      })
      .catch(e => { setCamError(e.name==='NotAllowedError'?'Camera permission denied':'Camera not available'); });
    return () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
    };
  },[active]);

  // Run detection every 1.5s
  useEffect(() => {
    if (!camReady || !faceApiReady || !active) {
      if(intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // FIX 1: 1000ms interval (was 1500ms), smoothing over 5 frames (was 4)
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const det = await window.faceapi
          .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({
            inputSize: 224, scoreThreshold: 0.5
          }))
          .withFaceExpressions();

        if (det?.expressions) {
          const exprs = det.expressions;
          const top   = Object.entries(exprs).sort((a,b)=>b[1]-a[1])[0];

          // Smooth over last 5 frames (FIX 1: was 4)
          historyRef.current.push({ emotion: top[0], conf: top[1] });
          if (historyRef.current.length > 5) historyRef.current.shift();

          const counts = {};
          historyRef.current.forEach(h => { counts[h.emotion] = (counts[h.emotion]||0) + 1; });
          const stable  = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
          const matched = historyRef.current.filter(h=>h.emotion===stable);
          const avgConf = matched.reduce((s,h)=>s+h.conf,0) / matched.length;

          setFaceEmotion(stable);
          setFaceConf(parseFloat(avgConf.toFixed(2)));

          // FIX 5: Console log for debugging
          console.log(`[FaceAPI] face_emotion=${stable} conf=${(avgConf*100).toFixed(1)}% raw=${top[0]}(${(top[1]*100).toFixed(0)}%)`);
        }
        // FIX 1: If no face detected — do NOT crash, do NOT reset (keep previous emotion)
        // No else clause = silent no-op on no face
      } catch(e) {
        // Silent catch — never crash UI on detection failure
      }
    }, 1000); // FIX 1: 1000ms interval
    return () => clearInterval(intervalRef.current);
  },[camReady, faceApiReady, active]);

  return { videoRef, canvasRef, faceEmotion, faceConf, camReady, faceApiReady, camError };
}

// ─── MOOD TREND MINI CHART ─────────────────────────────────────────────────────
function MoodTrendBar({ entries, accent }) {
  if (!entries || entries.length < 2) return null;
  const recent = entries.slice(-7);
  return (
    <div style={{padding:'10px 0 4px'}}>
      <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',marginBottom:8}}>📈 Mood Trend</p>
      <div style={{display:'flex',alignItems:'flex-end',gap:4,height:36}}>
        {recent.map((e,i)=>{
          const t = THEME[e.emotion]||THEME.neutral;
          const h = Math.max(8, (e.confidence/100)*36);
          return (
            <div key={i} title={`${e.emotion} ${e.confidence}%`} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{width:'100%',height:h,background:t.accent,borderRadius:3,opacity:0.7+i*0.04,transition:'all 0.5s'}}/>
              <span style={{fontSize:8}}>{t.emoji}</span>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
        <span style={{fontSize:8,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.15)'}}>older</span>
        <span style={{fontSize:8,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.15)'}}>now</span>
      </div>
    </div>
  );
}

// ─── BREATHING ANIMATION CIRCLE ────────────────────────────────────────────────
function BreathCircle({ active, accent, phase, scale }) {
  return (
    <div style={{position:'relative',width:180,height:180,margin:'0 auto 16px'}}>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`1px solid ${accent}22`}}/>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`1px solid ${accent}11`,transform:'scale(1.12)'}}/>
      <div style={{
        position:'absolute',inset:24,borderRadius:'50%',
        border:`2px solid ${active?accent:'rgba(255,255,255,0.1)'}`,
        background:active?`radial-gradient(circle,${accent}20,transparent)`:'transparent',
        transform:`scale(${scale})`,
        transition:'transform 1s ease-in-out,border-color 0.5s,background 0.5s',
        boxShadow:active?`0 0 50px ${accent}25,0 0 100px ${accent}10`:'none',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      }}>
        {active && <>
          <span style={{fontSize:11,color:'#e2eaf0',fontFamily:'Fraunces,serif',letterSpacing:1,opacity:0.8}}>{phase?.label||''}</span>
          <span style={{fontSize:34,color:'#fff',fontFamily:'DM Mono,monospace',lineHeight:1.1}}>{phase?.count||'—'}</span>
        </>}
        {!active && <span style={{fontSize:32,opacity:0.3}}>🌿</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 1 COMPONENT: EMOTION DETECTION PANEL (ORIGINAL PRESERVED)
// ═══════════════════════════════════════════════════════════════════════════════
function EmotionPanel({ emotion, confidence, triggers, emotionMap, faceEmotion, faceConf, signalsAgree, accent, muted }) {
  const t = THEME[emotion]||THEME.neutral;
  const r = 22, circ = 2*Math.PI*r;
  const filled = circ*(confidence/100);
  return (
    <div style={{background:t.card,border:`1px solid ${t.accent}30`,borderRadius:16,padding:'14px 16px',animation:'panelIn 0.5s ease forwards',opacity:0,transition:'all 0.8s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',margin:'0 0 3px'}}>TASK 1 · EMOTION DETECTED</p>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:22}}>{t.emoji}</span>
            <span style={{fontFamily:'Fraunces,serif',fontSize:22,color:'#edf4f0',fontWeight:400}}>{t.label}</span>
            {signalsAgree && <span style={{fontSize:9,background:'rgba(78,212,138,0.15)',border:'1px solid rgba(78,212,138,0.3)',borderRadius:10,padding:'2px 7px',color:'#4ed48a',fontFamily:'DM Mono,monospace'}}>MULTI-SIGNAL ✓</span>}
          </div>
        </div>
        <div style={{position:'relative',width:56,height:56,flexShrink:0}}>
          <svg viewBox="0 0 56 56" style={{transform:'rotate(-90deg)',width:56,height:56}}>
            <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
            <circle cx="28" cy="28" r={r} fill="none" stroke={t.accent} strokeWidth="4"
              strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
              style={{transition:'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)'}}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:13,fontFamily:'DM Mono,monospace',color:t.accent,fontWeight:500,lineHeight:1}}>{confidence}</span>
            <span style={{fontSize:7,color:'rgba(255,255,255,0.3)',fontFamily:'DM Mono,monospace'}}>%</span>
          </div>
        </div>
      </div>
      {/* Face emotion signal */}
      {faceEmotion && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'7px 10px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)'}}>
          <span style={{fontSize:14}}>📷</span>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.4)'}}>Camera:</span>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:t.muted,textTransform:'capitalize'}}>{faceEmotion}</span>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.25)',marginLeft:'auto'}}>{Math.round(faceConf*100)}%</span>
        </div>
      )}
      {triggers?.length > 0 && (
        <div style={{marginBottom:10}}>
          <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:1.5,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',margin:'0 0 6px'}}>Signals detected</p>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {triggers.map((tr,i)=>(
              <span key={i} style={{fontSize:10,fontFamily:'DM Mono,monospace',background:tr.tier==='high'?`${t.accent}25`:`${t.accent}12`,border:`1px solid ${t.accent}${tr.tier==='high'?'50':'28'}`,borderRadius:20,padding:'3px 9px',color:t.accent}}>
                {tr.word}
              </span>
            ))}
          </div>
        </div>
      )}
      {emotionMap && Object.keys(emotionMap).length > 1 && (
        <div>
          <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:1.5,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',margin:'0 0 7px'}}>Emotion distribution</p>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {Object.entries(emotionMap).sort((a,b)=>b[1]-a[1]).map(([em,pct])=>(
              <div key={em} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:10,width:52,color:'rgba(255,255,255,0.35)',fontFamily:'DM Mono,monospace',flexShrink:0}}>{em}</span>
                <div style={{flex:1,height:5,background:'rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:THEME[em]?.accent||t.accent,borderRadius:10,transition:'width 1s ease'}}/>
                </div>
                <span style={{fontSize:9,width:28,color:'rgba(255,255,255,0.25)',fontFamily:'DM Mono,monospace',textAlign:'right'}}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 2 COMPONENT: CRISIS SCREEN (ORIGINAL PRESERVED + enhanced)
// ═══════════════════════════════════════════════════════════════════════════════
function CrisisScreen({ level, onBack, helplines }) {
  const levels = {
    1:{title:"I hear you. Things feel really hard right now.",color:'#f4a836',bg:'#0f0800',sub:"You don't have to face this alone."},
    2:{title:"You matter. Please reach out to someone right now.",color:'#ff6b35',bg:'#0f0500',sub:"A real person is ready to listen."},
    3:{title:"You are not alone. Help is here — right now.",color:'#ff4444',bg:'#0d0000',sub:"Please contact a crisis line immediately."},
  };
  const l = levels[level]||levels[2];
  const trustedMsg = encodeURIComponent("Hi, I am going through a really hard time and need support right now. Can you reach out to me?");

  return (
    <div style={{position:'fixed',inset:0,background:l.bg,zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'30px 20px',animation:'crisisIn 0.6s ease forwards',backdropFilter:'blur(20px)'}}>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 40%, ${l.color}08, transparent 70%)`,pointerEvents:'none'}}/>
      <div style={{maxWidth:480,width:'100%',textAlign:'center',position:'relative',zIndex:1}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${l.color}18`,border:`1px solid ${l.color}40`,borderRadius:20,padding:'5px 14px',marginBottom:20}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:l.color,animation:'pulse 1.5s ease infinite'}}/>
          <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:l.color,letterSpacing:2,textTransform:'uppercase'}}>Crisis Level {level} · Auto-detected</span>
        </div>
        <h1 style={{fontFamily:'Fraunces,serif',fontSize:clamp(22,5,28),color:'#edf4f0',fontWeight:400,lineHeight:1.35,marginBottom:10}}>{l.title}</h1>
        <p style={{fontSize:15,color:'rgba(255,255,255,0.45)',marginBottom:30}}>{l.sub}</p>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
          {(helplines||[]).map((h,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${l.color}25`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:26,flexShrink:0}}>{h.flag}</span>
              <div style={{flex:1,textAlign:'left'}}>
                <div style={{fontSize:14,fontWeight:500,color:'#edf4f0'}}>{h.name}</div>
                <div style={{fontFamily:'DM Mono,monospace',fontSize:12,color:l.color}}>{h.number}</div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                {h.type==='phone'&&<a href={`tel:${h.number.replace(/\D/g,'')}`} style={{display:'flex',alignItems:'center',gap:4,background:`${l.color}20`,border:`1px solid ${l.color}40`,borderRadius:9,padding:'7px 12px',textDecoration:'none',color:l.color,fontSize:12,fontWeight:500}}>📞 Call</a>}
                {h.type==='web'&&<a href={`https://${h.number}`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:4,background:`${l.color}20`,border:`1px solid ${l.color}40`,borderRadius:9,padding:'7px 12px',textDecoration:'none',color:l.color,fontSize:12}}>💬 Chat</a>}
                {h.wa&&<a href={`https://wa.me/${h.wa}?text=I+need+support`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:4,background:'rgba(37,211,102,0.15)',border:'1px solid rgba(37,211,102,0.3)',borderRadius:9,padding:'7px 12px',textDecoration:'none',color:'#25d366',fontSize:12}}>💬 WA</a>}
              </div>
            </div>
          ))}
        </div>
        {/* Extra crisis actions */}
        <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:20,flexWrap:'wrap'}}>
          <a href="https://maps.google.com/?q=mental+health+support+near+me" target="_blank" rel="noreferrer"
            style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'8px 14px',textDecoration:'none',color:'rgba(255,255,255,0.5)',fontSize:12}}>
            📍 Find Help Near Me
          </a>
          <a href={`https://wa.me/?text=${trustedMsg}`} target="_blank" rel="noreferrer"
            style={{display:'flex',alignItems:'center',gap:5,background:'rgba(37,211,102,0.1)',border:'1px solid rgba(37,211,102,0.2)',borderRadius:10,padding:'8px 14px',textDecoration:'none',color:'#25d366',fontSize:12}}>
            💬 Alert Trusted Contact
          </a>
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'14px 18px',marginBottom:20}}>
          <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7,margin:0,fontStyle:'italic'}}>"These feelings are temporary. Reaching out is the bravest thing you can do. You deserve support."</p>
        </div>
        <button onClick={onBack} style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'11px 28px',color:'rgba(255,255,255,0.5)',fontFamily:'DM Sans,sans-serif',fontSize:13,cursor:'pointer',transition:'all 0.2s'}}>← I want to keep talking</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 3 COMPONENT: BREATH WIDGET (ORIGINAL PRESERVED + BreathCircle integrated)
// ═══════════════════════════════════════════════════════════════════════════════
function BreathWidget({ accent, exercises, onClose, embedded }) {
  const [sel, setSel]         = useState(null);
  const [running, setRunning] = useState(false);
  const [phIdx, setPhIdx]     = useState(0);
  const [count, setCount]     = useState(0);
  const [cycles, setCycles]   = useState(0);
  const [gStep, setGStep]     = useState(0);
  const tmr = useRef(null);

  const stopBreath = useCallback(() => { clearInterval(tmr.current); setRunning(false); setPhIdx(0); setCount(0); setCycles(0); },[]);
  const startBreath = (ex) => { setSel(ex); stopBreath(); setGStep(0); };

  useEffect(() => {
    if (!running || !sel?.phases) return;
    const ph = sel.phases[phIdx];
    setCount(ph.seconds);
    tmr.current = setInterval(() => {
      setCount(p => {
        if (p <= 1) { clearInterval(tmr.current); setPhIdx(prev => { const n=(prev+1)%sel.phases.length; if(n===0)setCycles(c=>c+1); return n; }); return 0; }
        return p-1;
      });
    },1000);
    return ()=>clearInterval(tmr.current);
  },[running, phIdx, sel]);

  useEffect(() => {
    if (!running || !sel?.phases) return;
    const ph = sel.phases[phIdx];
    setCount(ph.seconds);
    tmr.current = setInterval(() => {
      setCount(p=>{if(p<=1){clearInterval(tmr.current);setPhIdx(prev=>{const n=(prev+1)%sel.phases.length;if(n===0)setCycles(c=>c+1);return n;});return 0;}return p-1;});
    },1000);
    return ()=>clearInterval(tmr.current);
  },[phIdx]); // eslint-disable-line

  const ph = sel?.phases?.[phIdx];
  const maxSec = ph?.seconds||4;
  const prog = running&&maxSec?((maxSec-count)/maxSec)*100:0;
  const scale = running?(phIdx%2===0?1+(prog/100)*0.42:1.42-(prog/100)*0.42):1;

  const inner = (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:22}}>
        {(exercises||[]).map(ex=>(
          <button key={ex.id} onClick={()=>startBreath(ex)} style={{background:sel?.id===ex.id?`${accent}16`:'rgba(255,255,255,0.03)',border:`1px solid ${sel?.id===ex.id?accent:'rgba(255,255,255,0.08)'}`,borderRadius:12,padding:'12px 10px',cursor:'pointer',textAlign:'left',transition:'all 0.2s'}}>
            <div style={{fontSize:20,marginBottom:4}}>{ex.icon}</div>
            <div style={{fontSize:12,fontWeight:500,color:'#e2eaf0',marginBottom:2}}>{ex.name}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.28)'}}>{ex.tagline}</div>
          </button>
        ))}
      </div>
      {sel?.type==='breath'&&(
        <div style={{textAlign:'center'}}>
          <BreathCircle active={running} accent={accent} phase={ph?{...ph,count}:null} scale={scale}/>
          {running&&ph?.instruction&&<p style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginBottom:10,fontStyle:'italic'}}>{ph.instruction}</p>}
          <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:10,margin:'0 0 12px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${prog}%`,background:accent,borderRadius:10,transition:'width 1s linear'}}/>
          </div>
          {cycles>0&&<p style={{fontSize:11,color:accent,fontFamily:'DM Mono,monospace',marginBottom:10}}>✓ {cycles} cycle{cycles>1?'s':''} complete</p>}
          <div style={{display:'flex',gap:5,justifyContent:'center',marginBottom:16,flexWrap:'wrap'}}>
            {sel.phases.map((p,i)=>(<span key={i} style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontFamily:'DM Mono,monospace',border:`1px solid ${running&&phIdx===i?accent:'rgba(255,255,255,0.1)'}`,color:running&&phIdx===i?accent:'rgba(255,255,255,0.2)',transition:'all 0.3s'}}>{p.label} {p.seconds}s</span>))}
          </div>
          <button onClick={()=>running?stopBreath():setRunning(true)} style={{padding:'10px 36px',borderRadius:10,border:'none',background:running?'rgba(255,255,255,0.08)':accent,color:running?'#e2eaf0':'#000',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:14,fontWeight:500,transition:'all 0.2s'}}>{running?'Stop':'Begin'}</button>
        </div>
      )}
      {sel?.type==='grounding'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',margin:0}}>Step {gStep+1} of {sel.steps.length}</p>
            <div style={{display:'flex',gap:4}}>{sel.steps.map((_,i)=>(<div key={i} style={{width:i===gStep?20:7,height:7,borderRadius:4,background:i===gStep?accent:i<gStep?`${accent}50`:'rgba(255,255,255,0.1)',transition:'all 0.3s'}}/>))}</div>
          </div>
          <div style={{background:`${accent}0a`,border:`1px solid ${accent}20`,borderRadius:14,padding:'20px',marginBottom:16,textAlign:'center',minHeight:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:30,marginBottom:8}}>{sel.icon}</div>
            {sel.steps[gStep].sense&&<span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:accent,letterSpacing:2,textTransform:'uppercase',marginBottom:10}}>{sel.steps[gStep].sense}</span>}
            <p style={{fontSize:15,color:'#d4dde4',lineHeight:1.7,margin:0}}>{sel.steps[gStep].prompt}</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            {gStep>0&&<button onClick={()=>setGStep(g=>g-1)} style={{flex:1,padding:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13}}>← Back</button>}
            <button onClick={()=>gStep<sel.steps.length-1?setGStep(g=>g+1):setGStep(0)} style={{flex:2,padding:'10px',background:gStep===sel.steps.length-1?`${accent}25`:accent,border:`1px solid ${accent}`,borderRadius:10,color:gStep===sel.steps.length-1?accent:'#000',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:500,transition:'all 0.2s'}}>{gStep===sel.steps.length-1?'Start again →':'Next →'}</button>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return inner;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(18px)',zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',animation:'fadeIn 0.25s ease'}}>
      <div style={{background:'#0d1419',border:'1px solid rgba(255,255,255,0.08)',borderRadius:24,padding:'28px 32px',maxWidth:460,width:'100%',maxHeight:'92vh',overflowY:'auto',position:'relative',animation:'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.05)',border:'none',borderRadius:'50%',width:30,height:30,color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13}}>✕</button>
        <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',marginBottom:6}}>TASK 3 · SUPPORT WIDGET</p>
        <h2 style={{fontFamily:'Fraunces,serif',fontSize:22,color:'#edf4f0',fontWeight:400,marginBottom:4}}>Guided Relief</h2>
        <p style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginBottom:20}}>Choose an exercise to begin</p>
        {inner}
      </div>
    </div>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
function Msg({ m, accent, onSpeak, isSpeaking }) {
  const u = m.role==='user';
  return (
    <div style={{display:'flex',gap:10,flexDirection:u?'row-reverse':'row',animation:'msgIn 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards',opacity:0,transform:'translateY(8px)'}}>
      <div style={{width:34,height:34,borderRadius:'50%',flexShrink:0,border:u?'1px solid rgba(255,255,255,0.1)':`1.5px solid ${accent}`,background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,transition:'border-color 0.8s',position:'relative'}}>
        {u?'👤':'🌿'}
        {!u&&isSpeaking&&<div style={{position:'absolute',inset:-3,borderRadius:'50%',border:`2px solid ${accent}`,animation:'speakPulse 1s ease infinite',opacity:0.6}}/>}
      </div>
      <div style={{maxWidth:'76%',display:'flex',flexDirection:'column',gap:4,alignItems:u?'flex-end':'flex-start'}}>
        <div style={{padding:'13px 17px',borderRadius:u?'18px 4px 18px 18px':'4px 18px 18px 18px',fontSize:14.5,lineHeight:1.75,background:u?`${accent}16`:'rgba(255,255,255,0.04)',border:`1px solid ${u?accent+'35':'rgba(255,255,255,0.07)'}`,color:'#d4dde4',whiteSpace:'pre-wrap',wordBreak:'break-word',transition:'all 0.8s'}}>
          {m.content}
        </div>
        {!u&&(
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {m.emotion&&m.emotion!=='neutral'&&<span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:accent,letterSpacing:1,opacity:0.6,textTransform:'uppercase'}}>{THEME[m.emotion]?.emoji} {m.emotion}</span>}
            <button onClick={()=>onSpeak(m.content)} style={{background:'none',border:'none',cursor:'pointer',color:isSpeaking?accent:'rgba(255,255,255,0.2)',fontSize:12,padding:'2px 5px',borderRadius:6,transition:'color 0.3s'}}>{isSpeaking?'🔊':'🔈'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function Typing({accent, speaking}) {
  return (
    <div style={{display:'flex',gap:10,animation:'msgIn 0.3s ease forwards',opacity:0}}>
      <div style={{width:34,height:34,borderRadius:'50%',border:`1.5px solid ${accent}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🌿</div>
      <div style={{padding:'14px 18px',borderRadius:'4px 18px 18px 18px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:5,alignItems:'center'}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:7,height:7,borderRadius:'50%',background:accent,opacity:0.5,animation:`bounce 1.3s ease infinite ${i*0.16}s`}}/>
        ))}
        <span style={{fontSize:11,color:'rgba(255,255,255,0.25)',fontFamily:'DM Mono,monospace',marginLeft:6}}>
          {speaking ? '🔊 talking...' : 'thinking...'}
        </span>
      </div>
    </div>
  );
}

// ─── Journal mini ─────────────────────────────────────────────────────────────
function Journal({ accent, entries, emotion, confidence, sessionId }) {
  const [text,setText] = useState('');
  const [saving,setSaving] = useState(false);
  const save = async () => {
    if(!text.trim()) return; setSaving(true);
    try {
      const r = await fetch('/api/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,text,emotion,confidence})});
      const d = await r.json(); if(d.success) setText('');
    } catch {}
    setSaving(false);
  };
  return (
    <div style={{padding:'16px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
      <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',marginBottom:10}}>📓 Journal ({entries.length} entries)</p>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write how you feel..." rows={2} style={{flex:1,background:'rgba(255,255,255,0.03)',border:`1px solid ${accent}25`,borderRadius:10,padding:'8px 12px',color:'#d4dde4',fontFamily:'DM Sans,sans-serif',fontSize:13,resize:'none',outline:'none'}}/>
        <button onClick={save} disabled={saving||!text.trim()} style={{padding:'8px 14px',background:accent,border:'none',borderRadius:10,color:'#000',cursor:'pointer',fontSize:12,fontWeight:500,opacity:saving||!text.trim()?0.4:1,flexShrink:0}}>Save</button>
      </div>
      <MoodTrendBar entries={entries} accent={accent}/>
      {entries.slice(-3).reverse().map(e=>(
        <div key={e.id} style={{borderLeft:`3px solid ${THEME[e.emotion]?.accent||accent}`,paddingLeft:10,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
            <span style={{fontSize:9,color:THEME[e.emotion]?.accent,fontFamily:'DM Mono,monospace'}}>{THEME[e.emotion]?.emoji} {e.emotion} · {e.confidence}%</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.2)',fontFamily:'DM Mono,monospace'}}>{fmtTime(e.timestamp)}</span>
          </div>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:0,lineHeight:1.5}}>{e.text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Coping suggestions row ───────────────────────────────────────────────────
function Coping({ items, accent }) {
  if (!items?.length) return null;
  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap',padding:'0 0 6px',animation:'panelIn 0.4s ease forwards',opacity:0}}>
      {items.slice(0,4).map((c,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:5,background:`${accent}10`,border:`1px solid ${accent}22`,borderRadius:20,padding:'5px 11px',fontSize:11,color:accent}}>
          <span style={{fontSize:14}}>{c.icon}</span><span>{c.title}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FACE CAMERA PANEL ─────────────────────────────────────────────────────────
function FaceCamPanel({ videoRef, faceEmotion, faceConf, camReady, faceApiReady, camError, accent, active }) {
  const faceTheme = faceEmotion ? THEME[{happy:'good',sad:'sad',angry:'angry',fearful:'anxious',disgusted:'angry',surprised:'neutral',neutral:'neutral'}[faceEmotion]||'neutral'] : THEME.neutral;
  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${accent}25`,borderRadius:14,overflow:'hidden'}}>
      <div style={{position:'relative'}}>
        <video ref={videoRef} muted playsInline autoPlay style={{width:'100%',height:160,objectFit:'cover',display:camReady?'block':'none',transform:'scaleX(-1)',filter:'brightness(0.85)'}}/>
        {!camReady&&(
          <div style={{width:'100%',height:160,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)',gap:8}}>
            <span style={{fontSize:28}}>📷</span>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontFamily:'DM Mono,monospace',textAlign:'center',padding:'0 12px'}}>
              {camError || (active ? (faceApiReady?'Starting camera...':'Loading face-api.js...') : 'Camera off')}
            </span>
          </div>
        )}
        {camReady&&faceEmotion&&(
          <div style={{position:'absolute',bottom:6,left:6,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',borderRadius:8,padding:'4px 10px',border:`1px solid ${faceTheme.accent}40`}}>
            <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:faceTheme.accent,textTransform:'capitalize'}}>{faceEmotion} {Math.round(faceConf*100)}%</span>
          </div>
        )}
        {!faceApiReady&&active&&!camError&&(
          <div style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.6)',borderRadius:6,padding:'3px 8px'}}>
            <span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.4)'}}>Loading models...</span>
          </div>
        )}
      </div>
      <div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:camReady&&faceApiReady?'#4ed48a':'rgba(255,255,255,0.2)',boxShadow:camReady&&faceApiReady?'0 0 6px #4ed48a':'none'}}/>
        <span style={{fontSize:10,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.3)'}}>
          {camReady&&faceApiReady ? 'Face detection active' : camError ? camError : 'Initializing...'}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [msgs, setMsgs]             = useState([{role:'assistant',content:"Hi 🌿 I'm MindEase — your private, emotion-aware mental health companion.\n\nI detect how you're feeling in real-time, adapt to your emotional state, and connect you with the right support — a breathing exercise, coping strategy, or a real person if needed.\n\nEverything stays on your device. No accounts. No data shared.\n\nHow are you feeling today?",emotion:'good'}]);
  const [inp, setInp]               = useState('');
  const [loading, setLoading]       = useState(false);
  const [speaking, setSpeaking]     = useState(false);
  const [emotion, setEmotion]       = useState('neutral');
  const [conf, setConf]             = useState(42);
  const [triggers, setTriggers]     = useState([]);
  const [emoMap, setEmoMap]         = useState({});
  const [coping, setCoping]         = useState([]);
  const [crisis, setCrisis]         = useState(false);
  const [crisisLevel, setCLvl]      = useState(0);
  const [helplines, setHelplines]   = useState([]);
  const [exercises, setExercises]   = useState([]);
  const [showCrisis, setShowCrisis] = useState(false);
  const [showBreath, setShowBreath] = useState(false);
  const [journalEntries, setJE]     = useState([]);
  const [showJournal, setShowJournal] = useState(false);
  const [ollama, setOllama]         = useState(null);
  const [tab, setTab]               = useState('chat');
  const [showCoping, setShowCoping] = useState(false);
  const [signalsAgree, setSignalsAgree] = useState(false);
  const [detectedLang, setDetectedLang] = useState('en');
  const [camActive, setCamActive]   = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(-1);

  const feedRef = useRef(null);
  const inpRef  = useRef(null);
  const T = THEME[emotion]||THEME.neutral;

  // Face emotion hook
  const face = useFaceEmotion(camActive);

  // Map lang to speech recognition locale
  // FIX 4: Speech recognition language mapping
  // Hindi → hi-IN, Hinglish → en-IN (picks up mixed input better), English → en-US
  const srLang = detectedLang==='hi' ? 'hi-IN'
               : detectedLang==='hinglish' ? 'en-IN'
               : 'en-US';

  // Voice hook — auto-sends after speech ends
  const voiceCallback = useCallback(t => {
    setInp(t);
    // Auto-send with slight delay
    setTimeout(() => {
      if(t.trim()) {
        setInp(t);
        // trigger send via ref
        sendRef.current(t);
      }
    }, 600);
  },[]);

  const voice = useVoice(voiceCallback, srLang);

  const sendRef = useRef(null);

  // Init
  useEffect(()=>{
    fetch('/api/health').then(r=>r.json()).then(d=>setOllama(d.ollama&&d.model_ready)).catch(()=>setOllama(false));
    fetch('/api/grounding').then(r=>r.json()).then(d=>setExercises(d.exercises||[])).catch(()=>{});
    // Load voices for TTS
    window.speechSynthesis?.getVoices();
  },[]);

  // Scroll
  useEffect(()=>{ if(feedRef.current) feedRef.current.scrollTop=feedRef.current.scrollHeight; },[msgs,loading]);

  // Real-time detection while typing
  useEffect(()=>{
    if(!inp.trim()||inp.length<5) return;
    const t=setTimeout(()=>{
      fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:inp})})
        .then(r=>r.json()).then(d=>{
          setEmotion(d.emotion); setConf(d.confidence||42);
          setTriggers(d.triggers||[]); setEmoMap(d.emotion_map||{});
          if(d.is_crisis) setCrisis(true);
        }).catch(()=>{});
    },500);
    return()=>clearTimeout(t);
  },[inp]);

  const handleInp = e => {
    setInp(e.target.value);
    e.target.style.height='auto';
    e.target.style.height=Math.min(e.target.scrollHeight,180)+'px';
  };

  const handleKey = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendRef.current();} };

  const send = useCallback(async (overrideText) => {
    const text = (overrideText || inp).trim();
    if(!text||loading) return;
    const history=[...msgs,{role:'user',content:text}];
    setMsgs(history); setInp(''); setLoading(true); setShowCoping(false);
    if(inpRef.current) inpRef.current.style.height='auto';
    stopTTS();

    try {
      const res = await fetch('/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          messages:history.map(m=>({role:m.role,content:m.content})),
          session_id:SID,
          face_emotion:face.faceEmotion,
          face_conf:face.faceConf,
        })
      });
      const d = await res.json();

      // FIX 5: Console logs for debugging
      console.log(`[MindEase] detected_language=${d.language} | emotion=${d.emotion} | confidence=${d.confidence}% | face_emotion=${face.faceEmotion||'none'} | signals_agree=${d.signals_agree}`);
      console.log('[MindEase] backend response:', { reply: d.reply?.slice(0,80)+'...', fusion_note: d.fusion_note, crisis_level: d.crisis_level });

      setEmotion(d.emotion||'neutral'); setConf(d.confidence||42);
      setTriggers(d.triggers||[]); setEmoMap(d.emotion_map||{});
      setCrisis(d.is_crisis||false); setCLvl(d.crisis_level||0);
      setSignalsAgree(d.signals_agree||false);
      setDetectedLang(d.language||'en');
      if(d.helplines) setHelplines(d.helplines);
      if(d.coping_suggestions){setCoping(d.coping_suggestions);setShowCoping(true);}
      if(d.is_crisis&&d.crisis_level>=2) setTimeout(()=>setShowCrisis(true),800);
      if(d.grounding&&d.grounding.length) setExercises(d.grounding);
      const newIdx = history.length; // index of the assistant reply in updated msgs
      setMsgs(prev=>[...prev,{role:'assistant',content:d.reply,emotion:d.emotion}]);
      // FIX 4: Voice language must EXACTLY match response language
      // Hindi → hi-IN, English → en-US, Hinglish → en-IN (Indian English accent)
      if(!d.is_crisis) {
        setTimeout(()=>{
          const ttsLang = d.language==='hi' ? 'hi-IN'
                        : d.language==='hinglish' ? 'en-IN'
                        : 'en-US';  // FIX 4: was en-IN, now en-US for English
          console.log(`[TTS] Speaking in lang=${ttsLang} (detected=${d.language})`);
          setSpeakingMsgIdx(newIdx);
          tts(d.reply, ttsLang, ()=>setSpeaking(true), ()=>{ setSpeaking(false); setSpeakingMsgIdx(-1); });
        }, 700);
      }
      fetch(`/api/journal?session_id=${SID}`).then(r=>r.json()).then(dj=>setJE(dj.entries||[]));
    } catch {
      setMsgs(prev=>[...prev,{role:'assistant',content:"⚠️ Can't connect. Run `ollama serve` in a terminal.",emotion:'neutral'}]);
    }
    setLoading(false);
    setTimeout(()=>inpRef.current?.focus(),80);
  },[inp, loading, msgs, face.faceEmotion, face.faceConf]);

  // Keep sendRef up-to-date for voice callback
  useEffect(()=>{ sendRef.current = send; },[send]);

  // Lang placeholder
  const placeholder = voice.on
    ? (voice.transcript ? `🎤 "${voice.transcript}"` : '🎤 Listening...')
    : detectedLang==='hi' ? 'आप कैसे हैं?' : detectedLang==='hinglish' ? 'Kya chal raha hai? Bata dost...' : "Share what's on your mind… (anonymous & safe)";

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:T.bg,color:'#d4dde4',position:'relative',overflow:'hidden',transition:'background 1.4s ease'}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400;500&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&display=swap');
        @keyframes msgIn     { to{opacity:1;transform:translateY(0);} }
        @keyframes panelIn   { to{opacity:1;} }
        @keyframes fadeIn    { from{opacity:0;} to{opacity:1;} }
        @keyframes popIn     { from{opacity:0;transform:scale(0.88);} to{opacity:1;transform:scale(1);} }
        @keyframes crisisIn  { from{opacity:0;transform:scale(1.03);} to{opacity:1;transform:scale(1);} }
        @keyframes bounce    { 0%,80%,100%{transform:translateY(0);opacity:0.4;} 40%{transform:translateY(-5px);opacity:1;} }
        @keyframes pulse     { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(0.7);opacity:0.3;} }
        @keyframes voicePulse{ 0%,100%{box-shadow:0 0 0 0 var(--ac,#4eb8d4);} 50%{box-shadow:0 0 0 10px transparent;} }
        @keyframes speakPulse{ 0%,100%{opacity:0.6;transform:scale(1);} 50%{opacity:0;transform:scale(1.3);} }
        @keyframes breathGlow{ 0%,100%{opacity:0.3;} 50%{opacity:0.8;} }
        * { box-sizing:border-box; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.07) transparent; }
        textarea:focus,button:focus{outline:none;}
        :root{--ac:${T.accent};}
      `}</style>

      {/* BG orbs */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',width:600,height:600,top:-200,right:-150,borderRadius:'50%',background:T.glow,filter:'blur(130px)',transition:'background 1.4s ease'}}/>
        <div style={{position:'absolute',width:450,height:450,bottom:-120,left:-120,borderRadius:'50%',background:T.glow,filter:'blur(110px)',transition:'background 1.4s ease',opacity:0.7}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${T.accent}06 1px,transparent 1px),linear-gradient(90deg,${T.accent}06 1px,transparent 1px)`,backgroundSize:'50px 50px',transition:'all 1.4s ease'}}/>
      </div>

      {/* ── HEADER ── */}
      <header style={{position:'relative',zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:54,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(28px)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.accent}88)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:`0 0 16px ${T.accent}30`,transition:'all 0.8s'}}>🌿</div>
          <span style={{fontFamily:'Fraunces,serif',fontSize:19,fontWeight:500,color:'#edf4f0',letterSpacing:-0.4}}>
            Mind<span style={{color:T.accent,transition:'color 0.8s'}}>Ease</span>
          </span>
        </div>

        {/* Fused mood pill */}
        <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:20,border:`1px solid ${T.accent}50`,background:`${T.accent}10`,fontFamily:'DM Mono,monospace',fontSize:10,color:T.accent,letterSpacing:1,textTransform:'uppercase',transition:'all 0.8s ease',flexShrink:0}}>
          {crisis&&<div style={{width:5,height:5,borderRadius:'50%',background:T.accent,animation:'pulse 1.5s ease infinite'}}/>}
          {T.emoji} {T.label} · {conf}%
          {signalsAgree && <span style={{fontSize:8,opacity:0.7,marginLeft:2}}>✓</span>}
        </div>

        <div style={{display:'flex',alignItems:'center',gap:5}}>
          {/* Speaking indicator */}
          {speaking&&(
            <div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:12,background:`${T.accent}15`,border:`1px solid ${T.accent}30`}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:T.accent,animation:'breathGlow 1s ease infinite'}}/>
              <span style={{fontSize:9,fontFamily:'DM Mono,monospace',color:T.accent}}>talking</span>
            </div>
          )}
          {/* Lang pill */}
          <div style={{padding:'3px 8px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',fontSize:9,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.3)'}}>
            {detectedLang==='hi'?'हिंदी':detectedLang==='hinglish'?'Hinglish':'EN'}
          </div>
          {/* Cam toggle */}
          <button onClick={()=>setCamActive(c=>!c)} title={camActive?'Turn off camera':'Turn on face detection'} style={{width:28,height:28,borderRadius:8,border:`1px solid ${camActive?T.accent:'rgba(255,255,255,0.08)'}`,background:camActive?`${T.accent}18`:'rgba(255,255,255,0.03)',color:camActive?T.accent:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
            📷
          </button>
          <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:12,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
            <span style={{fontSize:9}}>🔒</span>
            <span style={{fontSize:8,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.2)',letterSpacing:0.5}}>PRIVATE</span>
          </div>
          {ollama!==null&&<div title={ollama?'AI Online':'AI Offline'} style={{width:7,height:7,borderRadius:'50%',background:ollama?'#4ed48a':'#ff4f4f',boxShadow:`0 0 6px ${ollama?'#4ed48a':'#ff4f4f'}`}}/>}
        </div>
      </header>

      {/* Ollama warning */}
      {ollama===false&&(
        <div style={{background:'rgba(255,140,60,0.08)',borderBottom:'1px solid rgba(255,140,60,0.15)',padding:'7px 18px',flexShrink:0,position:'relative',zIndex:9}}>
          <span style={{color:'#ffaa60',fontSize:11,fontFamily:'DM Mono,monospace'}}>
            ⚠️ AI offline — run <code style={{background:'rgba(255,140,60,0.12)',padding:'1px 5px',borderRadius:4}}>ollama serve</code> then <code style={{background:'rgba(255,140,60,0.12)',padding:'1px 5px',borderRadius:4}}>ollama pull llama3.2</code>
          </span>
        </div>
      )}

      {/* Crisis strip */}
      {crisis&&!showCrisis&&(
        <div style={{background:'rgba(255,79,79,0.08)',borderBottom:'1px solid rgba(255,79,79,0.2)',padding:'9px 18px',display:'flex',alignItems:'center',gap:10,flexShrink:0,zIndex:9,position:'relative'}}>
          <span style={{fontSize:18}}>🆘</span>
          <div style={{flex:1}}><p style={{fontSize:13,color:'#ff8080',margin:0,fontWeight:500}}>You are not alone. Real support is available right now.</p></div>
          <button onClick={()=>setShowCrisis(true)} style={{background:'rgba(255,79,79,0.15)',border:'1px solid rgba(255,79,79,0.3)',borderRadius:9,padding:'7px 14px',color:'#ff7070',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:500,flexShrink:0}}>See Helplines →</button>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div style={{display:'flex',background:'rgba(0,0,0,0.3)',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0,zIndex:5,position:'relative'}}>
        {[
          {id:'chat',   icon:'💬', label:'Chat'},
          {id:'detect', icon:'🧠', label:'Detection'},
          {id:'breathe',icon:'🌬️', label:'Breathe'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 6px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontFamily:'DM Sans,sans-serif',fontWeight:500,color:tab===t.id?T.accent:'rgba(255,255,255,0.3)',borderBottom:tab===t.id?`2px solid ${T.accent}`:'2px solid transparent',transition:'all 0.2s',marginBottom:-1}}>
            <span style={{fontSize:14}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',position:'relative',zIndex:1}}>

        {/* CHAT TAB */}
        {tab==='chat'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Camera panel (if active) */}
            {camActive&&(
              <div style={{padding:'8px 18px 0',flexShrink:0}}>
                <FaceCamPanel
                  videoRef={face.videoRef}
                  faceEmotion={face.faceEmotion}
                  faceConf={face.faceConf}
                  camReady={face.camReady}
                  faceApiReady={face.faceApiReady}
                  camError={face.camError}
                  accent={T.accent}
                  active={camActive}
                />
              </div>
            )}

            {/* Feed */}
            <div ref={feedRef} style={{flex:1,overflowY:'auto',padding:'18px 18px 8px',display:'flex',flexDirection:'column',gap:16}}>
              {msgs.map((m,i)=>(
                <Msg key={i} m={m} accent={T.accent}
                  isSpeaking={speakingMsgIdx===i&&speaking}
                  onSpeak={t=>{ stopTTS(); const tl=detectedLang==='hi'?'hi-IN':'en-IN'; setSpeakingMsgIdx(i); tts(t,tl,()=>setSpeaking(true),()=>{setSpeaking(false);setSpeakingMsgIdx(-1);}); }}
                />
              ))}
              {loading&&<Typing accent={T.accent} speaking={speaking}/>}
            </div>

            {/* Coping chips */}
            {showCoping&&coping.length>0&&(
              <div style={{padding:'0 18px 4px'}}><Coping items={coping} accent={T.accent}/></div>
            )}

            {/* Journal */}
            {showJournal&&(
              <Journal accent={T.accent} entries={journalEntries} emotion={emotion} confidence={conf} sessionId={SID}/>
            )}

            {/* Input */}
            <div style={{padding:'8px 18px 18px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'flex-end',gap:8,background:'rgba(255,255,255,0.04)',border:`1px solid ${voice.on?T.accent+'80':T.accent+'45'}`,borderRadius:16,padding:'9px 11px',transition:'border-color 0.3s',boxShadow:voice.on?`0 0 20px ${T.accent}15`:'none'}}>
                {/* Voice mic */}
                {voice.ok&&(
                  <button onClick={voice.on?voice.stop:voice.start} style={{width:34,height:34,borderRadius:9,border:'none',flexShrink:0,background:voice.on?`${T.accent}25`:'rgba(255,255,255,0.05)',color:voice.on?T.accent:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',animation:voice.on?'voicePulse 1.5s ease infinite':'none'}}>🎤</button>
                )}
                <textarea ref={inpRef} value={inp} onChange={handleInp} onKeyDown={handleKey}
                  placeholder={placeholder} rows={1}
                  style={{flex:1,background:'none',border:'none',outline:'none',color:'#d4dde4',fontFamily:'DM Sans,sans-serif',fontSize:14.5,lineHeight:1.65,resize:'none',maxHeight:180,minHeight:22,caretColor:T.accent,transition:'color 0.3s'}}/>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  <button title="Stop speaking" onClick={stopTTS} style={{width:34,height:34,borderRadius:9,border:`1px solid rgba(255,255,255,0.08)`,background:'rgba(255,255,255,0.03)',color:speaking?T.accent:'rgba(255,255,255,0.2)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>🔇</button>
                  <button title="Breathing exercise" onClick={()=>setShowBreath(true)} style={{width:34,height:34,borderRadius:9,border:`1px solid ${T.accent}30`,background:T.dim,color:T.accent,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>🌬️</button>
                  <button title="Journal" onClick={()=>setShowJournal(j=>!j)} style={{width:34,height:34,borderRadius:9,border:`1px solid ${showJournal?T.accent:'rgba(255,255,255,0.1)'}`,background:showJournal?T.dim:'rgba(255,255,255,0.03)',color:showJournal?T.accent:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>📓</button>
                  <button onClick={()=>sendRef.current()} disabled={loading||!inp.trim()} style={{width:36,height:34,borderRadius:9,border:'none',background:loading||!inp.trim()?'rgba(255,255,255,0.06)':T.accent,color:loading||!inp.trim()?'rgba(255,255,255,0.2)':'#000',cursor:loading||!inp.trim()?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'5px 2px 0',fontSize:9,fontFamily:'DM Mono,monospace',color:'rgba(255,255,255,0.12)',letterSpacing:0.5}}>
                <span>🔒 Anonymous · No data stored · Offline AI · 🎤 Voice enabled</span>
                <span>Enter to send · Shift+Enter newline</span>
              </div>
            </div>
          </div>
        )}

        {/* DETECTION TAB */}
        {tab==='detect'&&(
          <div style={{flex:1,overflowY:'auto',padding:'18px',display:'flex',flexDirection:'column',gap:14}}>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:0,lineHeight:1.6}}>Real-time emotion detection engine. Type in chat — this panel updates live. Camera data fused when active.</p>
            {/* Camera in detect tab */}
            {camActive&&(
              <FaceCamPanel videoRef={face.videoRef} faceEmotion={face.faceEmotion} faceConf={face.faceConf} camReady={face.camReady} faceApiReady={face.faceApiReady} camError={face.camError} accent={T.accent} active={camActive}/>
            )}
            {!camActive&&(
              <button onClick={()=>setCamActive(true)} style={{padding:'10px',background:'rgba(255,255,255,0.03)',border:`1px dashed ${T.accent}30`,borderRadius:12,color:T.accent,fontSize:12,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                📷 Enable Face Emotion Detection
              </button>
            )}
            <EmotionPanel emotion={emotion} confidence={conf} triggers={triggers} emotionMap={emoMap} faceEmotion={face.faceEmotion} faceConf={face.faceConf} signalsAgree={signalsAgree} accent={T.accent} muted={T.muted}/>
            {coping.length>0&&(
              <div>
                <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',marginBottom:10}}>TASK 3 · COPING DELIVERY</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {coping.map((c,i)=>(
                    <div key={i} style={{display:'flex',gap:12,background:`${T.accent}09`,border:`1px solid ${T.accent}25`,borderRadius:12,padding:'11px 14px'}}>
                      <span style={{fontSize:22,flexShrink:0}}>{c.icon}</span>
                      <div><div style={{fontSize:13,fontWeight:500,color:'#d4dde4',marginBottom:2}}>{c.title}</div><div style={{fontSize:11.5,color:'rgba(255,255,255,0.35)',lineHeight:1.5}}>{c.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <MoodTrendBar entries={journalEntries} accent={T.accent}/>
          </div>
        )}

        {/* BREATHE TAB */}
        {tab==='breathe'&&(
          <div style={{flex:1,overflowY:'auto',padding:'18px'}}>
            <p style={{fontSize:9,fontFamily:'DM Mono,monospace',letterSpacing:2,color:'rgba(255,255,255,0.2)',textTransform:'uppercase',marginBottom:12}}>TASK 3 · BREATHING & GROUNDING WIDGET</p>
            <BreathWidget accent={T.accent} exercises={exercises} onClose={()=>setTab('chat')} embedded/>
          </div>
        )}
      </div>

      {/* ── CRISIS FULL-SCREEN ── */}
      {showCrisis&&<CrisisScreen level={crisisLevel||2} helplines={helplines.length?helplines:[{name:'iCall',number:'9152987821',flag:'🇮🇳',tag:'24/7 Free',wa:'919152987821',type:'phone'},{name:'Vandrevala',number:'1860-2662-345',flag:'🇮🇳',tag:'Crisis',wa:null,type:'phone'}]} onBack={()=>setShowCrisis(false)}/>}

      {/* ── BREATHING MODAL ── */}
      {showBreath&&<BreathWidget accent={T.accent} exercises={exercises} onClose={()=>setShowBreath(false)}/>}
    </div>
  );
}
