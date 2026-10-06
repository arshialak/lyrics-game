console.log("Sher Yadet Nare loaded.");

// dom references

const audio = document.getElementById("audio");
const lyricsDiv = document.getElementById("lyrics");
const challengeList = document.getElementById("challenge-list");
const nowPlaying = document.getElementById("now-playing");

// state

let songConfig = null;
let songsIndex = [];

let pausedForGuess = false;
let hasRevealed = false;
let selectedSongId = null;

// helpers

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// load song index

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

// render artist and difficulty board

function renderChallengeBoard() {
  challengeList.innerHTML = "";

  // group songs by artist
  // artist comparison is case-insensitive

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

    // artist name

    const artist = document.createElement("div");

    artist.className = "artist-name";
    artist.textContent = artistGroup.artist;

    // find songs for each difficulty

    const song500 = artistGroup.songs.find(
      (song) => Number(song.difficulty) === 500,
    );

    const song1000 = artistGroup.songs.find(
      (song) => Number(song.difficulty) === 1000,
    );

    const button500 = createDifficultyButton(500, song500);
    const button1000 = createDifficultyButton(1000, song1000);

    row.appendChild(artist);
    row.appendChild(button500);
    row.appendChild(button1000);

    challengeList.appendChild(row);
  });
}

// create difficulty button

function createDifficultyButton(difficulty, song) {
  const button = document.createElement("button");

  button.className = "difficulty-btn";
  button.textContent = difficulty;
  button.dataset.difficulty = difficulty;

  // disable the button if there is no song for this difficulty

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

// select challenge

function selectChallenge(song, clickedButton) {
  selectedSongId = song.id;

  // remove the previous selected state

  document.querySelectorAll(".difficulty-btn.selected").forEach((button) => {
    button.classList.remove("selected");
  });

  clickedButton.classList.add("selected");

  nowPlaying.textContent = `${song.artist} • ${song.difficulty}`;

  loadSong(song.id);
}

// load song

// load song

async function loadSong(songId) {
  // id comparison is case-insensitive

  const normalizedId = normalizeText(songId);

  const songMeta = songsIndex.find(
    (song) => normalizeText(song.id) === normalizedId,
  );

  if (!songMeta) {
    console.error("Song not found:", songId);
    return;
  }

  const lyricsPath = `songs/lyrics/${songMeta.file}`;
  const audioPath = `songs/audio/${songMeta.id}.mp3`;

  try {
    const res = await fetch(lyricsPath);

    if (!res.ok) {
      throw new Error(`Could not load ${lyricsPath}: ${res.status}`);
    }

    songConfig = await res.json();

    console.log("Loaded song:", songConfig.title);

    // stop the previous song

    audio.pause();
    audio.currentTime = 0;

    // load the matching mp3

    audio.src = audioPath;
    audio.load();

    // reset game state

    pausedForGuess = false;
    hasRevealed = false;

    lyricsDiv.innerHTML = "";

    renderLyrics();

    // automatically start the song

    try {
      await audio.play();
    } catch (error) {
      console.error("Could not autoplay song:", error);
    }
  } catch (error) {
    console.error("Error loading song:", error);
  }
}

// render lyrics

function renderLyrics() {
  if (!songConfig) {
    return;
  }

  lyricsDiv.innerHTML = "";

  const guessIndices = songConfig.guessLines || [];

  const firstGuessIndex =
    guessIndices.length > 0 ? Math.min(...guessIndices) : null;

  songConfig.lines.forEach((line) => {
    // before reveal, only show lyrics up to the first guess line

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

    // replace the hidden guess line with the reveal button

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

// highlight current lyric line

function highlightCurrentLine(time) {
  if (!songConfig) {
    return;
  }

  const lyricsOffset = songConfig.lyricsOffset ?? 0;

  songConfig.lines.forEach((line) => {
    const el = lyricsDiv.querySelector(
      `[data-index="${line.index}"]`,
    );

    if (!el) {
      return;
    }

    const adjustedStart = line.start + lyricsOffset;
    const adjustedEnd = line.end + lyricsOffset;

    if (time >= adjustedStart && time < adjustedEnd) {
      el.classList.add("active-line");
    } else {
      el.classList.remove("active-line");
    }
  });
}

// get the guess window containing the current time

function getActiveGuessWindow(time) {
  if (!songConfig || hasRevealed) {
    return null;
  }

  const guessIndices = songConfig.guessLines || [];
  const pauseOffset = songConfig.pauseOffset ?? 0.5;

  for (const guessIndex of guessIndices) {
    const line = songConfig.lines.find(
      (line) => line.index === guessIndex,
    );

    if (!line) {
      continue;
    }

    // positive pauseOffset makes the protected window larger
    // negative pauseOffset makes the protected window smaller

    const windowStart = line.start - pauseOffset;
    const windowEnd = line.end + pauseOffset;

    if (time >= windowStart && time <= windowEnd) {
      return {
        line,
        windowStart,
        windowEnd,
      };
    }
  }

  return null;
}

// handle guess line pausing

function checkGuessPause() {
  if (!songConfig || hasRevealed) {
    return;
  }

  const current = audio.currentTime;
  const activeGuess = getActiveGuessWindow(current);

  // if we are outside the guess area, allow it to trigger again later

  if (!activeGuess) {
    pausedForGuess = false;
    return;
  }

  // pause whenever the playhead enters the guess area

  if (!pausedForGuess && !audio.paused) {
    audio.pause();
    pausedForGuess = true;
  }
}

// reveal button

lyricsDiv.addEventListener("click", (event) => {
  if (!event.target.classList.contains("reveal-inline-btn")) {
    return;
  }

  const index = Number(event.target.dataset.index);

  const line = songConfig.lines.find(
    (line) => line.index === index,
  );

  if (!line) {
    return;
  }

  hasRevealed = true;
  pausedForGuess = false;

  renderLyrics();

  // resume playback after one second

  if (audio.paused) {
    setTimeout(() => {
      audio.play();
    }, 1000);
  }
});

// update lyrics and guess state while playing

audio.addEventListener("timeupdate", () => {
  if (!songConfig) {
    return;
  }

  const current = audio.currentTime;

  checkGuessPause();
  highlightCurrentLine(current);
});

// recheck the guess area whenever someone seeks through the song

audio.addEventListener("seeked", () => {
  if (!songConfig || hasRevealed) {
    return;
  }

  const current = audio.currentTime;
  const activeGuess = getActiveGuessWindow(current);

  // seeking outside the guess area resets it

  if (!activeGuess) {
    pausedForGuess = false;
    highlightCurrentLine(current);
    return;
  }

  // seeking back into the guess area should stop playback again

  pausedForGuess = false;

  if (!audio.paused) {
    checkGuessPause();
  }

  highlightCurrentLine(current);
});

// also check immediately when playback starts

audio.addEventListener("play", () => {
  if (!songConfig || hasRevealed) {
    return;
  }

  const activeGuess = getActiveGuessWindow(audio.currentTime);

  if (activeGuess) {
    pausedForGuess = false;
    checkGuessPause();
  }
});

// init

loadSongIndex();
