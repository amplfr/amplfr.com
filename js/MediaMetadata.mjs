// based on https://github.com/GoogleChrome/samples/blob/gh-pages/media-session/mediaElement.js
if (!("mediaSession" in navigator)) {
  // need dummy functions
  const setup = () => {};
  const update = () => {};
} else {
  function playAudio() {
    mediaElement.src = playlist[index].src;
    mediaElement
      .play()
      .then((_) => update(audio))
      .catch((error) => log(error));
  }

  let mediaElement = null;
  let metadata = null;

  const setup = (mediaElement, metadata) => {
    mediaElement = mediaElement;
    metadata = metadata;
  };

  const update = (mediaElement = mediaElement, metadata = metadata) => {
    setup(mediaElement, metadata);
    log("Playing " + metadata.title || metadata || "" + " track...");
    //   navigator.mediaSession.metadata = new MediaMetadata({
    //     title: metadata.title,
    //     artist: metadata.artist,
    //     album: metadata.album,
    //     artwork: metadata.artwork
    //   });
    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    // Media is loaded, set the duration.
    updatePositionState();
  };

  /* Position state (supported since Chrome 81) */
  const updatePositionState = () => {
    if ("setPositionState" in navigator.mediaSession) {
      log("Updating position state...");
      navigator.mediaSession.setPositionState({
        duration: mediaElement.duration,
        playbackRate: mediaElement.playbackRate,
        position: mediaElement.currentTime,
      });
    }
  };

  /* Previous Track & Next Track */
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    log('> User clicked "Previous Track" icon.');
    this.previous();
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    log('> User clicked "Next Track" icon.');
    this.next();
  });

  // mediaElement.addEventListener('ended', () => {
  //   // Play automatically the next track when audio ends.
  //   index = (index - 1 + playlist.length) % playlist.length;
  //   playAudio();
  // });

  /* Seek Backward & Seek Forward */
  let defaultSkipTime = 10; /* Time to skip in seconds by default */

  navigator.mediaSession.setActionHandler("seekbackward", (e) => {
    log('> User clicked "Seek Backward" icon.');
    const skipTime = e.seekOffset || defaultSkipTime;
    mediaElement.currentTime = Math.max(mediaElement.currentTime - skipTime, 0);
    updatePositionState();
  });

  navigator.mediaSession.setActionHandler("seekforward", (e) => {
    log('> User clicked "Seek Forward" icon.');
    const skipTime = e.seekOffset || defaultSkipTime;
    mediaElement.currentTime = Math.min(
      mediaElement.currentTime + skipTime,
      mediaElement.duration
    );
    updatePositionState();
  });

  /* Play & Pause */
  navigator.mediaSession.setActionHandler("play", async function () {
    log('> User clicked "Play" icon.');
    this.play();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    log('> User clicked "Pause" icon.');
    this.pause();
  });
  mediaElement.addEventListener("play", () => {
    navigator.mediaSession.playbackState = "playing";
  });
  mediaElement.addEventListener("pause", () => {
    navigator.mediaSession.playbackState = "paused";
  });

  /* Stop (supported since Chrome 77) */
  try {
    navigator.mediaSession.setActionHandler("stop", () => {
      log('> User clicked "Stop" icon.');
      // TODO: Clear UI playback...
    });
  } catch (error) {
    log('Warning! The "stop" media session action is not supported.');
  }

  /* Seek To (supported since Chrome 78) */
  try {
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      log('> User clicked "Seek To" icon.');
      if (e.fastSeek && "fastSeek" in mediaElement) {
        mediaElement.fastSeek(e.seekTime);
        return;
      }
      mediaElement.currentTime = e.seekTime;
      updatePositionState();
    });
  } catch (error) {
    log('Warning! The "seekto" media session action is not supported.');
  }
}
