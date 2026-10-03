console.log("Sher Yadet Nare loaded.");

// DOM REFERENCES
const audio = document.getElementById("audio");
const lyricsDiv = document.getElementById("lyrics");
const songSelect = document.getElementById("song-select");

// STATE
let songConfig = null;
let pausedForGuess = false;
let songsIndex = []; // from songs/index.json
let hasRevealed = false; // controls whether lines after guess are shown

// LOAD SONG INDEX (playlist)
async function loadSongIndex() {
  const res = await fetch("songs/index.json");
  songsIndex = await res.json();

  // Build dropdown menu with a placeholder
  songSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select a song --";
  placeholder.disabled = true;
  placeholder.selected = true;
  songSelect.appendChild(placeholder);

  songsIndex.forEach((song) => {
    const opt = document.createElement("option");
    opt.value = song.id;
    opt.textContent = song.artist;
    songSelect.appendChild(opt);
  });
}

// LOAD A SPECIFIC SONG BY id
async function loadSong(songId) {
  const songMeta = songsIndex.find((s) => s.id === songId);

  if (!songMeta) {
    console.error("Song not found in index:", songId);
    return;
  }

  // Load lyrics/config JSON from songs/lyrics/
  const res = await fetch(`songs/lyrics/${songMeta.file}`);
  songConfig = await res.json();

  console.log("Loaded song:", songConfig.title);

  // Load matching MP3 from songs/audio/
  audio.src = `songs/audio/${songId}.mp3`;

  // Reset round state
  pausedForGuess = false;
  hasRevealed = false;
  lyricsDiv.innerHTML = "";

  renderLyrics();
}

// RENDER LYRICS
function renderLyrics() {
  lyricsDiv.innerHTML = "";

  const guessIndices = songConfig.guessLines || [];
  const firstGuessIndex =
    guessIndices.length > 0 ? Math.min(...guessIndices) : null;

  songConfig.lines.forEach((line) => {
    // Before reveal: only show up to and including the guess line
    if (
      !hasRevealed &&
      firstGuessIndex !== null &&
      line.index > firstGuessIndex
    ) {
      return;
    }

    const div = document.createElement("div");
    div.className = "line";
    div.dataset.index = line.index;

    // Guess line → show reveal button instead of lyric
    if (!hasRevealed && guessIndices.includes(line.index)) {
      div.classList.add("guess-line");

      const btn = document.createElement("button");
      btn.textContent = "Reveal Lyrics";
      btn.className = "reveal-inline-btn";
      btn.dataset.index = line.index;

      div.appendChild(btn);
    } else {
      div.textContent = line.text;
    }

    lyricsDiv.appendChild(div);
  });
}

// HIGHLIGHT CURRENT LINE
function highlightCurrentLine(time) {
  if (!songConfig) return;

  songConfig.lines.forEach((line) => {
    const el = lyricsDiv.querySelector(
      `[data-index="${line.index}"]`
    );

    if (!el) return;

    if (time >= line.start && time < line.end) {
      el.classList.add("active-line");
    } else {
      el.classList.remove("active-line");
    }
  });
}

// INLINE REVEAL BUTTON CLICKS
lyricsDiv.addEventListener("click", (e) => {
  if (!e.target.classList.contains("reveal-inline-btn")) return;

  const index = Number(e.target.dataset.index);
  const line = songConfig.lines.find((l) => l.index === index);

  if (!line) return;

  hasRevealed = true;

  // Re-render full lyrics
  renderLyrics();

  // Resume playback if paused
  if (audio.paused) {
    setTimeout(() => {
      audio.play();
    }, 1000);
  }
});

// AUDIO TIME UPDATE → PAUSE BEFORE FIRST GUESS LINE
audio.addEventListener("timeupdate", () => {
  if (!songConfig) return;

  const current = audio.currentTime;
  const guessIndices = songConfig.guessLines || [];

  for (const guessIndex of guessIndices) {
    const line = songConfig.lines.find(
      (l) => l.index === guessIndex
    );

    if (!line) continue;

    const pauseTime =
      line.start - (songConfig.pauseOffset || 0.5);

    if (!pausedForGuess && current >= pauseTime) {
      audio.pause();
      pausedForGuess = true;
      break;
    }
  }

  highlightCurrentLine(current);
});

// SONG MENU CHANGE HANDLER
songSelect.addEventListener("change", () => {
  const selectedId = songSelect.value;
  loadSong(selectedId);
});

// INIT
loadSongIndex();
