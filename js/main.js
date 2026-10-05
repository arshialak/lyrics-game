console.log("Sher Yadet Nare loaded.");

// -------------------------
// DOM REFERENCES
// -------------------------

const audio = document.getElementById("audio");

const lyricsDiv = document.getElementById("lyrics");

const challengeList = document.getElementById("challenge-list");

const nowPlaying = document.getElementById("now-playing");

// -------------------------
// STATE
// -------------------------

let songConfig = null;

let songsIndex = [];

let pausedForGuess = false;

let hasRevealed = false;

let selectedSongId = null;

// -------------------------
// HELPERS
// -------------------------

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// -------------------------
// LOAD SONG INDEX
// -------------------------

async function loadSongIndex() {
  try {
    const res = await fetch("songs/index.json");

    if (!res.ok) {
      throw new Error(`Could not load songs/index.json: ${res.status}`);
    }

    songsIndex = await res.json();

    renderChallengeBoard();
  } catch (error) {
    console.error("Error loading song index:", error);
  }
}

// -------------------------
// RENDER ARTIST / DIFFICULTY BOARD
// -------------------------

function renderChallengeBoard() {
  challengeList.innerHTML = "";

  /*
    Group songs by artist.

    Artist comparison is case-insensitive,
    so "Ebi", "ebi", and "EBI" are treated
    as the same artist.
  */

  const artistsMap = new Map();

  songsIndex.forEach((song) => {
    const artistKey = normalizeText(song.artist);

    if (!artistsMap.has(artistKey)) {
      artistsMap.set(artistKey, {
        artist: song.artist,
        songs: [],
      });
    }

    artistsMap.get(artistKey).songs.push(song);
  });

  artistsMap.forEach((artistGroup) => {
    const row = document.createElement("div");

    row.className = "challenge-row";

    // -------------------------
    // ARTIST NAME
    // -------------------------

    const artist = document.createElement("div");

    artist.className = "artist-name";

    artist.textContent = artistGroup.artist;

    // -------------------------
    // FIND DIFFICULTY SONGS
    // -------------------------

    const song500 = artistGroup.songs.find(
      (song) => Number(song.difficulty) === 500,
    );

    const song1000 = artistGroup.songs.find(
      (song) => Number(song.difficulty) === 1000,
    );

    // -------------------------
    // 500 BUTTON
    // -------------------------

    const button500 = createDifficultyButton(500, song500);

    // -------------------------
    // 1000 BUTTON
    // -------------------------

    const button1000 = createDifficultyButton(1000, song1000);

    row.appendChild(artist);

    row.appendChild(button500);

    row.appendChild(button1000);

    challengeList.appendChild(row);
  });
}

// -------------------------
// CREATE DIFFICULTY BUTTON
// -------------------------

function createDifficultyButton(difficulty, song) {
  const button = document.createElement("button");

  button.className = "difficulty-btn";

  button.textContent = difficulty;

  button.dataset.difficulty = difficulty;

  /*
    If no song exists for this difficulty,
    disable the button.
  */

  if (!song) {
    button.disabled = true;
    return button;
  }

  button.dataset.songId = song.id;

  button.addEventListener("click", () => {
    selectChallenge(song, button);
  });

  return button;
}

// -------------------------
// SELECT CHALLENGE
// -------------------------

function selectChallenge(song, clickedButton) {
  selectedSongId = song.id;

  // Remove previous selected state
  document.querySelectorAll(".difficulty-btn.selected").forEach((button) => {
    button.classList.remove("selected");
  });

  clickedButton.classList.add("selected");

  nowPlaying.textContent = `${song.artist} • ${song.difficulty}`;

  loadSong(song.id);
}

// -------------------------
// LOAD SONG
// -------------------------

async function loadSong(songId) {
  /*
    ID comparison is case-insensitive.
  */

  const normalizedId = normalizeText(songId);

  const songMeta = songsIndex.find(
    (song) => normalizeText(song.id) === normalizedId,
  );

  if (!songMeta) {
    console.error("Song not found:", songId);

    return;
  }

  const lyricsPath = `songs/lyrics/${songMeta.file}`;

  /*
    Audio filename matches the song ID.

    Example:

    ID:
    500-ebi-harighe-sabz

    becomes:

    songs/audio/
    500-ebi-harighe-sabz.mp3
  */

  const audioPath = `songs/audio/${songMeta.id}.mp3`;

  try {
    const res = await fetch(lyricsPath);

    if (!res.ok) {
      throw new Error(`Could not load ${lyricsPath}: ${res.status}`);
    }

    songConfig = await res.json();

    console.log("Loaded song:", songConfig.title);

    // Stop previous song
    audio.pause();

    audio.currentTime = 0;

    // Load matching MP3
    audio.src = audioPath;

    // Reset game state
    pausedForGuess = false;

    hasRevealed = false;

    lyricsDiv.innerHTML = "";

    renderLyrics();
  } catch (error) {
    console.error("Error loading song:", error);
  }
}

// -------------------------
// RENDER LYRICS
// -------------------------

function renderLyrics() {
  if (!songConfig) {
    return;
  }

  lyricsDiv.innerHTML = "";

  const guessIndices = songConfig.guessLines || [];

  const firstGuessIndex =
    guessIndices.length > 0 ? Math.min(...guessIndices) : null;

  songConfig.lines.forEach((line) => {
    /*
        Before reveal:
        only show lyrics up to
        the first guess line.
      */

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

    /*
        Guess line:
        don't show the lyric yet.
        Show the reveal button instead.
      */

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

// -------------------------
// HIGHLIGHT CURRENT LINE
// -------------------------

function highlightCurrentLine(time) {
  if (!songConfig) {
    return;
  }

  songConfig.lines.forEach((line) => {
    const el = lyricsDiv.querySelector(`[data-index="${line.index}"]`);

    if (!el) {
      return;
    }

    const lyricsOffset = songConfig.lyricsOffset ?? 0;

    const adjustedStart = line.start + lyricsOffset;
    const adjustedEnd = line.end + lyricsOffset;

    if (time >= adjustedStart && time < adjustedEnd) {
      el.classList.add("active-line");
    } else {
      el.classList.remove("active-line");
    }
  });
}

// -------------------------
// REVEAL BUTTON
// -------------------------

lyricsDiv.addEventListener("click", (event) => {
  if (!event.target.classList.contains("reveal-inline-btn")) {
    return;
  }

  const index = Number(event.target.dataset.index);

  const line = songConfig.lines.find((line) => line.index === index);

  if (!line) {
    return;
  }

  hasRevealed = true;

  renderLyrics();

  /*
      Resume playback after one second.
    */

  if (audio.paused) {
    setTimeout(() => {
      audio.play();
    }, 1000);
  }
});

// -------------------------
// AUDIO TIME UPDATE
// -------------------------

audio.addEventListener("timeupdate", () => {
  if (!songConfig) {
    return;
  }

  const current = audio.currentTime;

  const guessIndices = songConfig.guessLines || [];

  for (const guessIndex of guessIndices) {
    const line = songConfig.lines.find((line) => line.index === guessIndex);

    if (!line) {
      continue;
    }

    const pauseTime = line.start - (songConfig.pauseOffset || 0.5);

    if (!pausedForGuess && current >= pauseTime) {
      audio.pause();

      pausedForGuess = true;

      break;
    }
  }

  highlightCurrentLine(current);
});

// -------------------------
// INIT
// -------------------------

loadSongIndex();
