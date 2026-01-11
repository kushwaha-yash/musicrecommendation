/* ==========================================================
   NAVBAR + MOBILE MENU
========================================================== */
const hamburgerBtn = document.getElementById("hamburgerBtn");
const navLinks = document.getElementById("navLinks");

if (hamburgerBtn && navLinks) {
  hamburgerBtn.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

/* ==========================================================
   AUTH MODAL
========================================================== */
const authModal = document.getElementById("authModal");
const authBackdrop = document.getElementById("authBackdrop");
const authCloseBtn = document.getElementById("authCloseBtn");
const authTriggers = document.querySelectorAll("[data-auth]");
const authTabs = document.querySelectorAll(".auth-tab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

function openAuthModal(tab = "login") {
  authModal.classList.remove("hidden");
  setActiveTab(tab);
}

function closeAuthModal() {
  authModal.classList.add("hidden");
}

function setActiveTab(tab) {
  authTabs.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.tab === tab)
  );
  loginForm.classList.toggle("hidden", tab !== "login");
  signupForm.classList.toggle("hidden", tab !== "signup");
}

authTriggers.forEach((btn) =>
  btn.addEventListener("click", () => openAuthModal(btn.dataset.auth))
);

authCloseBtn.addEventListener("click", closeAuthModal);
authBackdrop.addEventListener("click", closeAuthModal);

/* ==========================================================
   SIGNUP
========================================================== */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = signupForm.name.value.trim();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value.trim();

  const res = await fetch("http://127.0.0.1:5000/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (data.error) return alert("❌ " + data.error);

  alert("✔ Signup successful!");
  setActiveTab("login");
});

/* ==========================================================
   LOGIN
========================================================== */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value.trim();

  const res = await fetch("http://127.0.0.1:5000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (data.error) return alert("❌ " + data.error);

  localStorage.setItem("user", JSON.stringify(data.user));
  closeAuthModal();
  updateNavbarUI();
  window.location.reload();
});

/* ==========================================================
   NAVBAR UI
========================================================== */
function updateNavbarUI() {
  const user = JSON.parse(localStorage.getItem("user"));
  document.getElementById("loginBtn").classList.toggle("hidden", !!user);
  document.getElementById("signupBtn").classList.toggle("hidden", !!user);
  document.getElementById("userBox").classList.toggle("hidden", !user);

  if (user) {
    document.getElementById("navUserName").textContent = `👋 Hi, ${user.name}`;
  }
}
window.onload = updateNavbarUI;

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("user");
  updateNavbarUI();
});

/* ==========================================================
   FLOATING NOTES
========================================================== */
const floatingNotes = document.getElementById("floatingNotes");
const noteSymbols = ["♪", "♫", "♬", "♩"];

function createFloatingNote() {
  const note = document.createElement("div");
  note.classList.add("music-note");
  note.innerText = noteSymbols[Math.floor(Math.random() * noteSymbols.length)];
  note.style.left = Math.random() * 100 + "vw";
  note.style.animationDuration = 4 + Math.random() * 3 + "s";
  floatingNotes.appendChild(note);
  setTimeout(() => note.remove(), 5000);
}
setInterval(createFloatingNote, 700);

/* ==========================================================
   RESULT BOX
========================================================== */
let resultBox = document.createElement("div");
resultBox.classList.add("result-box");
document.querySelector(".hero-content").appendChild(resultBox);

const searchInput = document.querySelector(".hero-search input");
const searchBtn = document.querySelector(".hero-search .btn.primary");

searchBtn.addEventListener("click", fetchResults);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchResults();
});

/* ==========================================================
   PLAYER ELEMENTS
========================================================== */
const titleEl = document.getElementById("playerTitle");
const artistEl = document.getElementById("playerArtist");
const coverEl = document.getElementById("playerCover");
const playButton = document.getElementById("btnPlay");
const prevButton = document.getElementById("btnPrev");
const nextButton = document.getElementById("btnNext");
const restartBtn = document.getElementById("btnRestart");
const progressFill = document.querySelector(".progress-fill");
const queueList = document.getElementById("queueList");

let queue = [];
let currentIndex = -1;
let audio = new Audio();
let isPlaying = false;

/* ==========================================================
   RESET RATING STARS
========================================================== */
function resetRatingStars() {
  document.querySelectorAll("#ratingBox .star").forEach((s) => {
    s.classList.remove("active");
  });
}

/* ==========================================================
   PLAY TRACK
========================================================== */
function playTrack(i) {
  const t = queue[i];
  currentIndex = i;

  resetRatingStars();

  titleEl.textContent = t.name;
  artistEl.textContent = t.artists;
  coverEl.src = t.image || "/static/images/default.jpg";

  audio.pause();
  progressFill.style.width = "0%";

  if (!t.preview_url) {
    playButton.textContent = "No Preview";
    playButton.disabled = true;
    return;
  }

  playButton.disabled = false;
  audio.src = t.preview_url;
  audio.currentTime = 0;
  audio.play();

  isPlaying = true;
  playButton.textContent = "⏸";

  audio.ontimeupdate = () => {
    progressFill.style.width = (audio.currentTime / 30) * 100 + "%";
  };

  audio.onended = nextTrack;

  renderQueue();
}

/* ==========================================================
   NEXT / PREVIOUS
========================================================== */
function nextTrack() {
  if (currentIndex + 1 < queue.length) playTrack(currentIndex + 1);
}
function prevTrack() {
  if (currentIndex > 0) playTrack(currentIndex - 1);
}
nextButton.onclick = nextTrack;
prevButton.onclick = prevTrack;

/* ==========================================================
   PLAY / PAUSE
========================================================== */
playButton.onclick = () => {
  if (!audio.src) return;

  if (isPlaying) {
    audio.pause();
    playButton.textContent = "▶";
  } else {
    audio.play();
    playButton.textContent = "⏸";
  }
  isPlaying = !isPlaying;
};

/* ==========================================================
   RESTART
========================================================== */
restartBtn.onclick = () => {
  if (!audio.src) return;
  audio.currentTime = 0;
};

/* ==========================================================
   QUEUE RENDER
========================================================== */
function renderQueue() {
  queueList.innerHTML = "";

  queue.forEach((t, i) => {
    queueList.innerHTML += `
      <div class="queue-item ${i === currentIndex ? "active" : ""}" data-i="${i}">
        <img src="${t.image || '/static/images/default.jpg'}" class="thumb">
        <div class="info">
          <p class="title">${t.name}</p>
          <p class="artist">${t.artists}</p>
        </div>
      </div>
    `;
  });

  document.querySelectorAll(".queue-item").forEach((item) => {
    item.addEventListener("click", () => playTrack(Number(item.dataset.i)));
  });
}

/* ==========================================================
   HYBRID ML + SPOTIFY CALL
========================================================== */
async function fetchResults() {
  const q = searchInput.value.trim();
  if (!q) return alert("Enter a song or mood!");

  const user = JSON.parse(localStorage.getItem("user"));

  resultBox.innerHTML = "<p>Searching...</p>";

  const res = await fetch("http://127.0.0.1:5000/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: q,
      user_id: user?.id || null,
    }),
  });

  const data = await res.json();
  showResults(data.tracks || []);
}

/* ==========================================================
   SHOW RESULTS
========================================================== */
function showResults(tracks) {
  if (!tracks || tracks.length === 0) {
    resultBox.innerHTML = "<p>No songs found.</p>";
    return;
  }

  queue = tracks;
  currentIndex = -1;

  resultBox.innerHTML = tracks
    .map(
      (t, i) => `
      <div class="rec-item" data-i="${i}">
        <img src="${t.image || '/static/images/default.jpg'}" width="60">
        <b>${t.name}</b><br>
        <span>${t.artists}</span>
        <p class="reason-tag">${t.reason || ''}</p>
      </div>`
    )
    .join("");

  document.querySelectorAll(".rec-item").forEach((item) => {
    item.addEventListener("click", () => playTrack(Number(item.dataset.i)));
  });
}

/* ==========================================================
   MOOD QUICK SEARCH
========================================================== */
document.querySelectorAll(".mood-card").forEach((card) => {
  card.addEventListener("click", () => {
    const mood = card.id.replace("mood-", "");
    searchInput.value = mood;
    fetchResults();
  });
});

/* ==========================================================
   RATING SYSTEM
========================================================== */
document.getElementById("ratingBox").addEventListener("click", async (e) => {
  if (!e.target.classList.contains("star")) return;

  if (currentIndex === -1)
    return alert("❗ Play a song first!");

  const track = queue[currentIndex];
  const rating = Number(e.target.dataset.v);

  resetRatingStars();

  document.querySelectorAll("#ratingBox .star").forEach((s) => {
    if (Number(s.dataset.v) <= rating) s.classList.add("active");
  });

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return alert("❗ Please login to rate songs.");

  const payload = {
    user_id: user.id,
    song_name: track.name,
    rating: rating,
  };

  const res = await fetch("http://127.0.0.1:5000/rate_song", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.error) return alert("❌ " + data.error);

  alert("⭐ Rating saved!");
});
