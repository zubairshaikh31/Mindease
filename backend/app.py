"""
MindEase Enhanced — HackToon 1.0 UPGRADED
All original Task 1/2/3 functionality PRESERVED + enhanced with:
- Face emotion fusion (/api/fuse_emotion)
- Multi-signal emotion fusion logic
- Trusted contact WhatsApp endpoint
- Enhanced language detection
- Mood trend tracking
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests, uuid
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

OLLAMA_URL  = "http://localhost:11434/api/chat"
OLLAMA_TAGS = "http://localhost:11434/api/tags"
MODEL       = "llama3.2"

EMOTION_LEXICON = {
    "crisis": {
        "high":   ["suicide", "kill myself", "end my life", "want to die", "self harm",
                   "hurt myself", "no reason to live", "can't go on", "end it all",
                   "better off dead", "giving up on life", "not worth living",
                   "disappear forever", "wish i was dead"],
        "medium": ["tired of living", "can't take it anymore", "no point in anything",
                   "nobody cares if i'm gone", "want it all to stop", "done with everything"],
        "hindi":  ["marna chahta", "jeena nahi", "khatam karna", "zindagi nahi chahiye"],
    },
    "sad": {
        "high":   ["depressed", "hopeless", "worthless", "devastated", "heartbroken",
                   "grief", "miserable", "empty inside", "numb", "broken"],
        "medium": ["sad", "crying", "lonely", "alone", "isolated", "in pain",
                   "feel nothing", "can't stop crying", "no one cares", "lost"],
        "hindi":  ["dukhi", "udaas", "rona", "akela", "toot gaya"],
    },
    "anxious": {
        "high":   ["panic attack", "can't breathe", "heart racing", "terrified",
                   "paralyzed by fear", "spiraling", "can't stop overthinking"],
        "medium": ["anxious", "anxiety", "worried", "nervous", "overwhelmed", "stressed",
                   "scared", "fear", "dread", "pressure", "exams", "deadline", "presentation"],
        "hindi":  ["darr", "ghabrahat", "tension", "chinta", "dar lag raha"],
    },
    "angry": {
        "high":   ["furious", "rage", "hatred", "want to destroy", "can't control anger"],
        "medium": ["angry", "frustrated", "irritated", "mad", "annoyed", "fed up",
                   "unfair", "not fair", "hate this", "sick of", "bitter"],
        "hindi":  ["gussa", "krodh", "naraaz", "chidhchidha"],
    },
    "good": {
        "high":   ["amazing", "fantastic", "overjoyed", "thrilled", "on top of the world"],
        "medium": ["happy", "grateful", "calm", "peaceful", "hopeful", "better",
                   "motivated", "positive", "content", "relieved", "proud", "excited"],
        "hindi":  ["khush", "acha lag raha", "prasann", "mast"],
    },
}

CONFIDENCE_WEIGHTS = {"high": 35, "medium": 18, "hindi": 25}
MAX_SCORE = 105

def detect_emotion(text: str) -> dict:
    t = text.lower()
    results = {}
    for emotion, tiers in EMOTION_LEXICON.items():
        score = 0
        triggers = []
        for tier, keywords in tiers.items():
            for kw in keywords:
                if kw in t:
                    score += CONFIDENCE_WEIGHTS.get(tier, 10)
                    triggers.append({"word": kw, "tier": tier, "weight": CONFIDENCE_WEIGHTS.get(tier, 10)})
        if score > 0:
            confidence = min(int((score / MAX_SCORE) * 100) + 40, 97)
            results[emotion] = {"raw_score": score, "confidence": confidence, "triggers": triggers}
    if not results:
        return {"emotion":"neutral","confidence":42,"triggers":[],"emotion_map":{},"is_crisis":False,"crisis_level":0}
    dominant = max(results, key=lambda e: results[e]["raw_score"])
    dom_data = results[dominant]
    crisis_level = 0
    if dominant == "crisis":
        raw = dom_data["raw_score"]
        if raw >= 70: crisis_level = 3
        elif raw >= 40: crisis_level = 2
        else: crisis_level = 1
    return {
        "emotion":dominant,"confidence":dom_data["confidence"],
        "triggers":dom_data["triggers"][:4],
        "emotion_map":{e: v["confidence"] for e, v in results.items()},
        "is_crisis":dominant=="crisis","crisis_level":crisis_level,
    }

def detect_language(text: str) -> str:
    # FIX 2: Stronger language detection
    # Hindi: count Devanagari Unicode characters
    hindi_chars = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    if hindi_chars > 3:
        return "hi"

    # Hinglish: Roman-script Hindi keywords (expanded list)
    hinglish_words = [
        "main","mujhe","mera","tera","yaar","bhai","kya","nahi","nahi","haan",
        "acha","theek","bahut","bohot","dil","zindagi","kal","aaj","tum","hum",
        "pyaar","dost","matlab","sach","jhooth","bol","kar","tha","hai","ho",
        "raha","rahi","gaya","gaye","karo","karta","karti","lagta","lagti",
        "samajh","padhai","ghar","paisa","waqt","log","baat","chal","ab",
        "phir","lekin","kyunki","isliye","sirf","bas","agar","toh","waise",
        "thoda","bohot","bahut","accha","sunlo","dekho","pta","pata","kuch",
        "koi","sab","mujhse","tumhare","unka","apna","apni","woh","ye","vo"
    ]
    t_lower = text.lower()
    hinglish_count = sum(1 for w in hinglish_words if f' {w} ' in f' {t_lower} ' or t_lower.startswith(w+' ') or t_lower.endswith(' '+w))
    if hinglish_count >= 2:
        return "hinglish"

    return "en"

FACE_EMOTION_MAP = {
    "happy":"good","sad":"sad","angry":"angry","fearful":"anxious",
    "disgusted":"angry","surprised":"neutral","neutral":"neutral",
}

def fuse_emotions(text_emotion, text_conf, face_emotion=None, face_conf=0.0, voice_emotion=None, voice_conf=0):
    if text_emotion == "crisis":
        return {"fused_emotion":"crisis","fused_confidence":max(text_conf,80),"signals_agree":False,"fusion_note":"Crisis override"}
    scores = {}
    def add(em, conf, weight):
        mapped = FACE_EMOTION_MAP.get(em, em) if em else None
        if mapped and conf > 0:
            scores[mapped] = scores.get(mapped, 0) + conf * weight
    add(text_emotion, text_conf, 0.50)
    add(face_emotion, int(face_conf * 100), 0.35)
    add(voice_emotion, voice_conf, 0.15)
    if not scores:
        return {"fused_emotion":"neutral","fused_confidence":42,"signals_agree":False,"fusion_note":"No signals"}
    fused = max(scores, key=lambda e: scores[e])
    raw_conf = min(int(scores[fused]), 95)
    face_mapped = FACE_EMOTION_MAP.get(face_emotion, face_emotion) if face_emotion else None
    signals_agree = face_mapped == text_emotion == fused
    if signals_agree: raw_conf = min(raw_conf + 12, 97)
    return {"fused_emotion":fused,"fused_confidence":raw_conf,"signals_agree":signals_agree,
            "fusion_note":f"Text({text_emotion})+Face({face_emotion})+Voice({voice_emotion})"}

CRISIS_ESCALATION = {
    1:{"label":"Mild Distress","color":"#f4a836","action":"Show coping strategies"},
    2:{"label":"High Risk","color":"#ff6b35","action":"Show helplines prominently"},
    3:{"label":"Immediate Crisis","color":"#ff4444","action":"Full crisis screen lockout"},
}

HELPLINES = [
    {"name":"iCall","number":"9152987821","flag":"🇮🇳","tag":"24/7 Free","wa":"919152987821","type":"phone"},
    {"name":"Vandrevala","number":"1860-2662-345","flag":"🇮🇳","tag":"24/7 Crisis","wa":None,"type":"phone"},
    {"name":"AASRA","number":"9820466627","flag":"🇮🇳","tag":"Suicide Prev","wa":None,"type":"phone"},
    {"name":"iCall Chat","number":"icallhelpline.org","flag":"💬","tag":"Online Chat","wa":None,"type":"web"},
]

COPING_MAP = {
    "crisis":[{"icon":"🆘","title":"Call iCall Now","desc":"9152987821 — Free, 24/7"},{"icon":"💬","title":"WhatsApp Support","desc":"Text a trained volunteer"},{"icon":"🌬️","title":"Breathe with me","desc":"Start box breathing now"},{"icon":"🏥","title":"Emergency Services","desc":"Call 112 — India"}],
    "sad":[{"icon":"📓","title":"Write it out","desc":"3 raw feelings, unfiltered"},{"icon":"🚶","title":"5-minute walk","desc":"Movement shifts brain chemistry"},{"icon":"🎵","title":"Music therapy","desc":"Match mood, then gradually shift"},{"icon":"🤗","title":"Reach out","desc":"Text one trusted person"}],
    "anxious":[{"icon":"🌬️","title":"Box Breathing","desc":"4s in → hold → 4s out"},{"icon":"🖐️","title":"5-4-3-2-1 Ground","desc":"Name what you see, hear, feel"},{"icon":"🧊","title":"Cold water reset","desc":"Activates calm reflex instantly"},{"icon":"✍️","title":"Worry dump","desc":"Write everything, close it"}],
    "angry":[{"icon":"💨","title":"10 deep breaths","desc":"Before any reaction"},{"icon":"🏃","title":"Physical release","desc":"Run, jump, move it out"},{"icon":"✍️","title":"Write & release","desc":"Brutal honesty on paper"},{"icon":"⏸️","title":"Strategic pause","desc":"Leave for 20 minutes"}],
    "good":[{"icon":"🌟","title":"Gratitude list","desc":"3 specific things today"},{"icon":"🎯","title":"Set an intention","desc":"Use this positive energy well"},{"icon":"💌","title":"Spread kindness","desc":"Message someone you love"},{"icon":"📈","title":"Build a micro-habit","desc":"Start something small right now"}],
    "neutral":[{"icon":"🧘","title":"Mindful minute","desc":"5 deep intentional breaths"},{"icon":"💧","title":"Hydrate","desc":"Drink a full glass of water"},{"icon":"📱","title":"Digital rest","desc":"20 minutes phone-free"},{"icon":"🌿","title":"Check in with yourself","desc":"What do you actually need?"}],
}

GROUNDING_EXERCISES = [
    {"id":"box","name":"Box Breathing","icon":"🌬️","tagline":"4-4-4-4 nervous system reset","type":"breath","phases":[{"label":"Inhale","seconds":4,"instruction":"Breathe in slowly through your nose"},{"label":"Hold","seconds":4,"instruction":"Hold gently — stay relaxed"},{"label":"Exhale","seconds":4,"instruction":"Breathe out slowly through your mouth"},{"label":"Hold","seconds":4,"instruction":"Rest — prepare for the next breath"}]},
    {"id":"478","name":"4-7-8 Breathing","icon":"💨","tagline":"Deep relaxation technique","type":"breath","phases":[{"label":"Inhale","seconds":4,"instruction":"Breathe in quietly through your nose"},{"label":"Hold","seconds":7,"instruction":"Hold your breath fully"},{"label":"Exhale","seconds":8,"instruction":"Exhale completely through your mouth"}]},
    {"id":"54321","name":"5-4-3-2-1 Grounding","icon":"🖐️","tagline":"Sense-based anxiety anchor","type":"grounding","steps":[{"num":5,"sense":"See","prompt":"Look around. Name 5 things you can see right now."},{"num":4,"sense":"Touch","prompt":"Notice 4 things you can physically feel or touch."},{"num":3,"sense":"Hear","prompt":"Listen carefully. Name 3 sounds you can hear."},{"num":2,"sense":"Smell","prompt":"Name 2 things you can smell (or like to smell)."},{"num":1,"sense":"Taste","prompt":"Name 1 thing you can taste right now."}]},
    {"id":"bodyscan","name":"Body Scan","icon":"🧘","tagline":"Progressive muscle relaxation","type":"grounding","steps":[{"num":1,"sense":"Settle","prompt":"Close your eyes. Take 3 slow, deep breaths."},{"num":2,"sense":"Feet","prompt":"Notice your feet. Wiggle your toes. Let them relax."},{"num":3,"sense":"Legs","prompt":"Move up to your legs. Let them feel heavy and loose."},{"num":4,"sense":"Core","prompt":"Notice your belly and chest. Let them soften."},{"num":5,"sense":"Shoulders","prompt":"Drop your shoulders away from your ears."},{"num":6,"sense":"Face","prompt":"Unclench your jaw. Relax your eyes. You are safe."}]},
]

def build_prompt(lang="en", fused_emotion=None, face_emotion=None):
    base = """You are MindEase, a compassionate mental health companion for students.

CORE RULES:
1. Always validate feelings FIRST before offering any solutions
2. Keep responses SHORT — 2-3 paragraphs, under 120 words
3. End EVERY response with one gentle open-ended question
4. CRISIS: If user mentions suicide/self-harm → lead with "You matter. I'm right here." → give iCall: 9152987821 → NO coping tips during crisis
5. Never diagnose. Never prescribe. Encourage professional help for serious issues.
6. Use warm first person: "I hear you", "I can feel how hard this is"
7. Pure conversational prose — no bullet points, no headers

RESPONSE STRUCTURE: 1) Empathy/validation 2) One gentle suggestion 3) Caring question

STYLE: Warm trusted friend, not clinical. Human, not robotic."""

    # FIX 2: Strict language rule embedded in prompt
    if lang == "hi":
        base += """

LANGUAGE RULE — CRITICAL — YOU MUST FOLLOW THIS:
You MUST respond ONLY in the same language as the user input.
The user is writing in Hindi. Respond ONLY in Hindi (Devanagari script: आप, मैं, हूँ etc).
DO NOT respond in English or Hinglish. Every single word must be in Hindi Devanagari script.
Example correct response: "मैं समझ सकता हूँ कि आप कितना कठिन महसूस कर रहे हैं..."
Example WRONG response: "I understand..." or "Main samajhta hoon..." """
    elif lang == "hinglish":
        base += """

LANGUAGE RULE — CRITICAL — YOU MUST FOLLOW THIS:
You MUST respond ONLY in the same language as the user input.
The user is writing in Hinglish (Hindi words in English/Roman script mixed with English).
Respond ONLY in Hinglish — mix Hindi words in Roman script with English naturally.
DO NOT respond in pure English or pure Hindi Devanagari script.
Example correct response: "Yaar, main samajh sakta hoon ki tum kitna힘들 feel kar rahe ho..."
Example WRONG response: "I understand you are feeling..." or "मैं समझता हूँ..." """
    else:
        base += """

LANGUAGE RULE — CRITICAL — YOU MUST FOLLOW THIS:
You MUST respond ONLY in the same language as the user input.
The user is writing in English. Respond ONLY in English.
DO NOT mix Hindi or any other language. Pure English only."""

    if fused_emotion and fused_emotion not in ("neutral","good"):
        tones = {
            "anxious": "Use a calm, grounding, reassuring tone. Slow the conversation down.",
            "sad":     "Use deep empathy and warmth. Acknowledge the pain without trying to fix it.",
            "angry":   "Validate the frustration. Don't push back. Create space for the feeling.",
            "crisis":  "Lead with 'You matter.' Be extremely gentle. Provide helpline immediately.",
        }
        tone = tones.get(fused_emotion,"")
        if tone: base += f"\n\nCURRENT DETECTED STATE: {fused_emotion.upper()}. {tone}"

    if face_emotion and face_emotion not in ("neutral","happy"):
        base += f"\n\nCAMERA shows user looks {face_emotion}. Factor this into your empathy."

    return base


# FIX 3: Language failsafe — detect mismatch and return safe fallback
FALLBACK_RESPONSES = {
    "hi": {
        "neutral": "मैं यहाँ हूँ और आपकी बात सुन रहा हूँ। आप कैसा महसूस कर रहे हैं?",
        "sad":     "मैं समझ सकता हूँ कि आप अभी बहुत कठिन समय से गुज़र रहे हैं। आप अकेले नहीं हैं। क्या आप मुझे और बता सकते हैं?",
        "anxious": "गहरी साँस लें — आप सुरक्षित हैं। मैं यहाँ हूँ। आप क्या महसूस कर रहे हैं?",
        "crisis":  "आप मुझे बहुत महत्वपूर्ण हैं। कृपया iCall को अभी कॉल करें: 9152987821। आप अकेले नहीं हैं।",
    },
    "hinglish": {
        "neutral": "Main yahan hoon, sun raha hoon. Kya chal raha hai tumhare saath?",
        "sad":     "Yaar, main samajh sakta hoon ki tum kitna mushkil feel kar rahe ho. Tum akele nahi ho. Thoda batao mujhe?",
        "anxious": "Ek baar gehri saans lo — sab theek hoga. Main yahan hoon. Kya chal raha hai?",
        "crisis":  "Tum bahut important ho mere liye. Please abhi iCall ko call karo: 9152987821. Tum akele nahi ho.",
    },
}

def language_failsafe(reply: str, expected_lang: str, emotion: str) -> str:
    """
    FIX 3: Check if LLM response is in the expected language.
    If mismatch detected, return a pre-written fallback response.
    """
    if expected_lang == "en":
        return reply  # English is default, always accept

    if expected_lang == "hi":
        # Count Devanagari chars in reply
        hindi_chars = sum(1 for c in reply if '\u0900' <= c <= '\u097F')
        if hindi_chars < 5:
            # LLM returned English/Hinglish instead of Hindi — use fallback
            fallback_key = emotion if emotion in FALLBACK_RESPONSES["hi"] else "neutral"
            fixed = FALLBACK_RESPONSES["hi"][fallback_key]
            print(f"[LANG_FAILSAFE] Expected Hindi, got non-Hindi. Using fallback for emotion={emotion}")
            return fixed

    if expected_lang == "hinglish":
        # Hinglish should contain some English words mixed with Hindi words
        # If it's pure English (no Hindi keywords at all), it's a mismatch
        hinglish_markers = ["yaar","bhai","kya","nahi","haan","acha","theek","main","tum",
                            "hum","kal","aaj","bahut","dil","zindagi","kar","tha","hai","ho"]
        reply_lower = reply.lower()
        found = sum(1 for w in hinglish_markers if w in reply_lower)
        # Also check if reply is ONLY Devanagari (pure Hindi instead of Hinglish)
        hindi_chars = sum(1 for c in reply if '\u0900' <= c <= '\u097F')
        if found < 1 and hindi_chars < 5:
            # Pure English returned — use Hinglish fallback
            fallback_key = emotion if emotion in FALLBACK_RESPONSES["hinglish"] else "neutral"
            fixed = FALLBACK_RESPONSES["hinglish"][fallback_key]
            print(f"[LANG_FAILSAFE] Expected Hinglish, got pure English. Using fallback for emotion={emotion}")
            return fixed

    return reply

journal_store = {}

@app.route("/api/health", methods=["GET"])
def health():
    try:
        r = requests.get(OLLAMA_TAGS, timeout=3)
        models = [m["name"] for m in r.json().get("models",[])]
        return jsonify({"status":"ok","ollama":True,"model_ready":any(MODEL in m for m in models),"model":MODEL})
    except:
        return jsonify({"status":"ok","ollama":False,"model_ready":False,"model":MODEL})

@app.route("/api/chat", methods=["POST"])
def chat():
    body       = request.get_json(force=True)
    messages   = body.get("messages",[])
    session_id = body.get("session_id","default")
    face_emotion = body.get("face_emotion")
    face_conf    = float(body.get("face_conf",0.0))
    if not messages: return jsonify({"error":"no messages"}),400
    user_text = messages[-1].get("content","")
    lang      = detect_language(user_text)
    emo_data  = detect_emotion(user_text)
    fusion    = fuse_emotions(emo_data["emotion"],emo_data["confidence"],face_emotion,face_conf)
    fused_emotion = fusion["fused_emotion"]
    fused_conf    = fusion["fused_confidence"]
    ollama_msgs = [{"role":"system","content":build_prompt(lang,fused_emotion,face_emotion)}]
    for m in messages:
        ollama_msgs.append({"role":m["role"],"content":m["content"]})
    try:
        r = requests.post(OLLAMA_URL,json={"model":MODEL,"messages":ollama_msgs,"stream":False},timeout=90)
        r.raise_for_status()
        reply = r.json()["message"]["content"]
        # FIX 3: Language failsafe — ensure response matches expected language
        reply = language_failsafe(reply, lang, fused_emotion)
    except requests.exceptions.ConnectionError:
        reply = "⚠️ AI engine offline. Please run `ollama serve` in a terminal."
    except Exception:
        reply = "Something went wrong. Please try again."
    emotion = fused_emotion
    if emotion not in ("neutral",):
        if session_id not in journal_store: journal_store[session_id]=[]
        journal_store[session_id].append({"id":str(uuid.uuid4())[:8],"timestamp":datetime.now().isoformat(),"text":user_text[:200],"emotion":emotion,"confidence":fused_conf,"crisis_level":emo_data["crisis_level"],"face_emotion":face_emotion})
    return jsonify({
        "reply":reply,"emotion":emotion,"confidence":fused_conf,
        "triggers":emo_data["triggers"],"emotion_map":emo_data["emotion_map"],
        "is_crisis":emo_data["is_crisis"],"crisis_level":emo_data["crisis_level"],
        "crisis_escalation":CRISIS_ESCALATION.get(emo_data["crisis_level"]),
        "helplines":HELPLINES if emo_data["is_crisis"] else [],
        "coping_suggestions":COPING_MAP.get(emotion,COPING_MAP["neutral"]),
        "grounding":GROUNDING_EXERCISES,"language":lang,
        "face_emotion":face_emotion,"fused_confidence":fused_conf,
        "signals_agree":fusion["signals_agree"],"fusion_note":fusion["fusion_note"],
    })

@app.route("/api/analyze",methods=["POST"])
def analyze():
    body=request.get_json(force=True); text=body.get("text","")
    emo=detect_emotion(text)
    return jsonify({**emo,"coping":COPING_MAP.get(emo["emotion"],COPING_MAP["neutral"])})

@app.route("/api/fuse_emotion",methods=["POST"])
def fuse_emotion_route():
    body=request.get_json(force=True)
    result=fuse_emotions(body.get("text_emotion","neutral"),int(body.get("text_conf",42)),body.get("face_emotion"),float(body.get("face_conf",0.0)),body.get("voice_emotion"),int(body.get("voice_conf",0)))
    return jsonify(result)

@app.route("/api/journal",methods=["GET","POST"])
def journal():
    sid=request.args.get("session_id","default") if request.method=="GET" else request.get_json(force=True).get("session_id","default")
    if request.method=="POST":
        d=request.get_json(force=True)
        e={"id":str(uuid.uuid4())[:8],"timestamp":datetime.now().isoformat(),"text":d.get("text","")[:500],"emotion":d.get("emotion","neutral"),"confidence":d.get("confidence",0),"crisis_level":0,"manual":True}
        if sid not in journal_store: journal_store[sid]=[]
        journal_store[sid].append(e)
        return jsonify({"success":True,"entry":e})
    return jsonify({"entries":journal_store.get(sid,[])[-30:]})

@app.route("/api/grounding",methods=["GET"])
def grounding():
    return jsonify({"exercises":GROUNDING_EXERCISES})

@app.route("/api/mood_trend",methods=["GET"])
def mood_trend():
    sid=request.args.get("session_id","default")
    entries=journal_store.get(sid,[])[-10:]
    trend=[{"emotion":e["emotion"],"confidence":e["confidence"],"timestamp":e["timestamp"]} for e in entries]
    return jsonify({"trend":trend})

if __name__=="__main__":
    print("\n🌿 MindEase Enhanced — HackToon 1.0 UPGRADED")
    print("="*50)
    print("→  http://localhost:5000")
    print("→  NEW: /api/fuse_emotion | /api/mood_trend")
    print("="*50+"\n")
    app.run(debug=True,port=5000,host="0.0.0.0")
