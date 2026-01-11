# ============================================
# FINAL MUSIC RECOMMENDER BACKEND (RAILWAY SAFE)
# ============================================

import os, re, ast, time
import numpy as np
import pandas as pd
import requests, joblib
import mysql.connector

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from urllib.parse import urlparse

# ============================================
# INIT
# ============================================
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================
# DATABASE (RAILWAY MYSQL_URL)
# ============================================
def get_db_connection():
    try:
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            raise Exception("DATABASE_URL not set")

        parsed = urlparse(db_url)

        return mysql.connector.connect(
            host=parsed.hostname,
            port=parsed.port,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip("/")
        )
    except Exception as e:
        print("⚠ DB connection failed:", e)
        return None

# ============================================
# LOAD DATASET
# ============================================
df2   = joblib.load(os.path.join(BASE_DIR, "songs_df.pkl"))
X_emb = joblib.load(os.path.join(BASE_DIR, "xemb.pkl"))

df2["name_clean"] = df2["name"].astype(str).str.lower()

def parse_artists(a):
    try:
        parsed = ast.literal_eval(a)
        if isinstance(parsed, list):
            return " ".join(x.lower() for x in parsed)
        return str(parsed).lower()
    except:
        return str(a).lower()

df2["artists_clean"] = df2["artists"].apply(parse_artists)

print("✔ Dataset loaded:", df2.shape)

# ============================================
# TEXT + MOOD LOGIC
# ============================================
def _norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().lower() if s else ""

def _words(s):
    return re.findall(r"\b\w+\b", _norm(s))

keyword_moods = {
    "sad":"sad","breakup":"sad","cry":"sad","alone":"sad",
    "happy":"happy","smile":"happy","joy":"happy",
    "dance":"dance","party":"dance","dj":"dance",
    "chill":"chill","calm":"chill","lofi":"chill","study":"chill",
    "energetic":"energetic","gym":"energetic",
    "romantic":"romantic","love":"romantic",
    "angry":"angry","rage":"angry"
}

def detect_mood(text):
    for w in _words(text):
        if w in keyword_moods:
            return keyword_moods[w]
    return None

def mood_to_vector(mood):
    return {
        "happy":[0.85,0.65,0.7],
        "sad":[0.2,0.25,0.25],
        "energetic":[0.6,0.9,0.85],
        "dance":[0.8,0.75,0.85],
        "chill":[0.45,0.3,0.35],
        "romantic":[0.65,0.4,0.55],
        "angry":[0.25,0.95,0.6]
    }.get(mood)

# ============================================
# DATASET RECOMMENDER
# ============================================
def dataset_recommend(query, top_n=6):
    q = _norm(query)
    mood = detect_mood(q)

    if mood:
        mv = mood_to_vector(mood)
        val = df2["valence"].to_numpy(float)
        en  = df2["energy"].to_numpy(float)
        dn  = df2["danceability"].to_numpy(float)

        dist = 0.5*(val-mv[0])**2 + 0.3*(en-mv[1])**2 + 0.2*(dn-mv[2])**2
        sim  = 1/(1+np.sqrt(dist))
        idx  = np.argsort(sim)[::-1][:top_n]

        return [{
            "name": df2.at[i,"name"],
            "artists": df2.at[i,"artists"],
            "reason": f"Mood: {mood}"
        } for i in idx]

    mask = df2["name_clean"].str.contains(q) | df2["artists_clean"].str.contains(q)
    if mask.sum() == 0:
        return []

    seed = mask.idxmax()
    sim = cosine_similarity(X_emb, X_emb[seed].reshape(1,-1)).ravel()
    sim[seed] = -999
    idx = np.argsort(sim)[::-1][:top_n]

    return [{
        "name": df2.at[i,"name"],
        "artists": df2.at[i,"artists"],
        "reason": f"Similar to {query}"
    } for i in idx]

# ============================================
# SPOTIFY
# ============================================
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

spotify_token, spotify_exp = None, 0

def get_spotify_token():
    global spotify_token, spotify_exp
    if spotify_token and time.time() < spotify_exp:
        return spotify_token

    res = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
    )

    j = res.json()
    spotify_token = j.get("access_token")
    spotify_exp = time.time() + j.get("expires_in", 0)
    return spotify_token

def spotify_search(q, limit=6):
    token = get_spotify_token()
    if not token:
        return []

    res = requests.get(
        "https://api.spotify.com/v1/search",
        headers={"Authorization": f"Bearer {token}"},
        params={"q": q, "type": "track", "limit": limit}
    )

    items = res.json().get("tracks", {}).get("items", [])
    return [{
        "name": it["name"],
        "artists": ", ".join(a["name"] for a in it["artists"]),
        "image": it["album"]["images"][0]["url"] if it["album"]["images"] else None,
        "preview_url": it["preview_url"],
        "reason": "Spotify"
    } for it in items]

# ============================================
# ROUTES
# ============================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    db = get_db_connection()
    if not db:
        return jsonify({"error": "DB unavailable"}), 503

    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email=%s", (data["email"],))
    if cur.fetchone():
        return jsonify({"error": "Email exists"}), 409

    hashed = generate_password_hash(data["password"])
    cur.execute(
        "INSERT INTO users (name,email,password) VALUES (%s,%s,%s)",
        (data["name"], data["email"], hashed)
    )
    db.commit()
    cur.close()
    db.close()
    return jsonify({"success": True})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    db = get_db_connection()
    if not db:
        return jsonify({"error": "DB unavailable"}), 503

    cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE email=%s", (data["email"],))
    user = cur.fetchone()
    cur.close()
    db.close()

    if not user or not check_password_hash(user["password"], data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    user.pop("password")
    return jsonify({"success": True, "user": user})

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    q = data["query"]
    user_id = data.get("user_id")

    db = get_db_connection()
    if db and user_id:
        cur = db.cursor()
        cur.execute(
            "INSERT INTO search_history (user_id, query) VALUES (%s,%s)",
            (user_id, q)
        )
        db.commit()
        cur.close()
        db.close()

    return jsonify({
        "tracks": dataset_recommend(q) + spotify_search(q)
    })

@app.route("/rate_song", methods=["POST"])
def rate_song():
    data = request.get_json()
    db = get_db_connection()
    if not db:
        return jsonify({"error": "DB unavailable"}), 503

    cur = db.cursor()
    cur.execute(
        "INSERT INTO ratings (user_id, song_name, rating) VALUES (%s,%s,%s)",
        (data["user_id"], data["song_name"], data["rating"])
    )
    db.commit()
    cur.close()
    db.close()
    return jsonify({"success": True})

# ============================================
# RUN
# ============================================
if __name__ == "__main__":
    print("SERVER STARTED ✔")
    app.run()
