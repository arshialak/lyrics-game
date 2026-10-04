console.log("Sher Yadet Nare loaded.");


// -------------------------
// DOM REFERENCES
// -------------------------

const audio =
  document.getElementById("audio");

const lyricsDiv =
  document.getElementById("lyrics");

const challengeList =
  document.getElementById("challenge-list");

const nowPlaying =
  document.getElementById("now-playing");


// -------------------------
// STATE
// -------------------------

let songConfig = null;

let songsIndex = [];

let pausedForGuess = false;

let hasRevealed = false;

let selectedSongId = null;


// -------------------------
// LOAD SONG INDEX
// -------------------------

async function loadSongIndex() {
  try {
    const res =
      await fetch("songs/index.json");

    if (!res.ok) {
      throw new Error(
        `Could not load songs/index.json: ${res.status}`
      );
    }

    songsIndex =
      await res.json();

    renderChallengeBoard();

  } catch (error) {
    console.error(
      "Error loading song index:",
      error
    );
  }
}


// -------------------------
// RENDER ARTIST / DIFFICULTY BOARD
// -------------------------

function renderChallengeBoard() {
  challengeList.innerHTML = "";

  songsIndex.forEach((song) => {

    const row =
      document.createElement("div");

    row.className =
      "challenge-row";


    // Artist name
    const artist =
      document.createElement("div");

    artist.className =
      "artist-name";

    artist.textContent =
      song.artist;


    // 500 button
    const button500 =
      document.createElement("button");

    button500.className =
      "difficulty-btn";

    button500.textContent =
      "500";

    button500.dataset.songId =
      song.id;

    button500.dataset.difficulty =
      "500";


    // Existing catalogue currently lives under 500
    button500.addEventListener(
      "click",
      () => {
        selectChallenge(
          song,
          button500
        );
      }
    );


    // 1000 button
    const button1000 =
      document.createElement("button");

    button1000.className =
      "difficulty-btn";

    button1000.textContent =
      "1000";

    // No second song yet
    button1000.disabled = true;


    row.appendChild(artist);

    row.appendChild(button500);

    row.appendChild(button1000);

    challengeList.appendChild(row);
  });
}


// -------------------------
// SELECT CHALLENGE
// -------------------------

function selectChallenge(
  song,
  clickedButton
) {

  selectedSongId =
    song.id;


  // Remove previous selected state
  document
    .querySelectorAll(
      ".difficulty-btn.selected"
    )
    .forEach((button) => {
      button.classList.remove(
        "selected"
      );
    });


  clickedButton.classList.add(
    "selected"
  );


  nowPlaying.textContent =
    `${song.artist} • 500`;


  loadSong(song.id);
}


// -------------------------
// LOAD SONG
// -------------------------

async function loadSong(songId) {

  const songMeta =
    songsIndex.find(
      (song) =>
        song.id === songId
    );


  if (!songMeta) {
    console.error(
      "Song not found:",
      songId
    );

    return;
  }


  const lyricsPath =
    `songs/lyrics/${songMeta.file}`;

  const audioPath =
    `songs/audio/${songId}.mp3`;


  try {

    const res =
      await fetch(lyricsPath);


    if (!res.ok) {
      throw new Error(
        `Could not load ${lyricsPath}: ${res.status}`
      );
    }


    songConfig =
      await res.json();


    console.log(
      "Loaded song:",
      songConfig.title
    );


    // Stop previous song
    audio.pause();

    audio.currentTime = 0;


    // Load matching MP3
    audio.src =
      audioPath;


    // Reset game state
    pausedForGuess =
      false;

    hasRevealed =
      false;


    lyricsDiv.innerHTML =
      "";


    renderLyrics();


  } catch (error) {

    console.error(
      "Error loading song:",
      error
    );

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


  const guessIndices =
    songConfig.guessLines || [];


  const firstGuessIndex =
    guessIndices.length > 0
      ? Math.min(...guessIndices)
      : null;


  songConfig.lines.forEach(
    (line) => {

      /*
      Before reveal:
      show only lines up to
      the first guess line.
      */

      if (
        !hasRevealed &&
        firstGuessIndex !== null &&
        line.index > firstGuessIndex
      ) {
        return;
      }


      const div =
        document.createElement("div");


      div.className =
        "line";


      div.dataset.index =
        line.index;


      /*
      Guess line:
      hide lyric and show reveal button.
      */

      if (
        !hasRevealed &&
        guessIndices.includes(
          line.index
        )
      ) {

        div.classList.add(
          "guess-line"
        );


        const btn =
          document.createElement(
            "button"
          );


        btn.textContent =
          "Reveal Lyrics";


        btn.className =
          "reveal-inline-btn";


        btn.dataset.index =
          line.index;


        div.appendChild(btn);

      } else {

        div.textContent =
          line.text;

      }


      lyricsDiv.appendChild(div);

    }
  );
}


// -------------------------
// HIGHLIGHT CURRENT LINE
// -------------------------

function highlightCurrentLine(time) {

  if (!songConfig) {
    return;
  }


  songConfig.lines.forEach(
    (line) => {

      const el =
        lyricsDiv.querySelector(
          `[data-index="${line.index}"]`
        );


      if (!el) {
        return;
      }


      if (
        time >= line.start &&
        time < line.end
      ) {

        el.classList.add(
          "active-line"
        );

      } else {

        el.classList.remove(
          "active-line"
        );

      }

    }
  );
}


// -------------------------
// REVEAL BUTTON
// -------------------------

lyricsDiv.addEventListener(
  "click",
  (event) => {

    if (
      !event.target.classList.contains(
        "reveal-inline-btn"
      )
    ) {
      return;
    }


    const index =
      Number(
        event.target.dataset.index
      );


    const line =
      songConfig.lines.find(
        (line) =>
          line.index === index
      );


    if (!line) {
      return;
    }


    hasRevealed = true;


    renderLyrics();


    /*
    Resume song after
    giving players a moment
    to see the answer.
    */

    if (audio.paused) {

      setTimeout(
        () => {
          audio.play();
        },
        1000
      );

    }

  }
);


// -------------------------
// AUDIO TIME UPDATE
// -------------------------

audio.addEventListener(
  "timeupdate",
  () => {

    if (!songConfig) {
      return;
    }


    const current =
      audio.currentTime;


    const guessIndices =
      songConfig.guessLines || [];


    for (
      const guessIndex
      of guessIndices
    ) {

      const line =
        songConfig.lines.find(
          (line) =>
            line.index ===
            guessIndex
        );


      if (!line) {
        continue;
      }


      const pauseTime =
        line.start -
        (
          songConfig.pauseOffset ||
          0.5
        );


      if (
        !pausedForGuess &&
        current >= pauseTime
      ) {

        audio.pause();

        pausedForGuess =
          true;

        break;

      }
    }


    highlightCurrentLine(
      current
    );

  }
);


// -------------------------
// INIT
// -------------------------

loadSongIndex();
