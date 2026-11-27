export async function installListeningEofRecorder(context) {
  await context.addInitScript(() => {
    let activePlayer;
    let playerGeneration = 0;
    window.k67TestListeningEof = null;
    const isCurrentPlayer = player => player instanceof HTMLAudioElement &&
      document.querySelector('#miniJourneyPlayer #miniJourneyAudio') === player;

    document.addEventListener('playing', event => {
      if (!event.isTrusted || !isCurrentPlayer(event.target)) return;
      activePlayer = event.target;
      playerGeneration += 1;
      window.k67TestListeningEof = null;
    }, true);
    document.addEventListener('error', event => {
      if (event.isTrusted && event.target === activePlayer) activePlayer = undefined;
    }, true);
    document.addEventListener('ended', event => {
      const player = event.target;
      if (!event.isTrusted || player !== activePlayer || !isCurrentPlayer(player) ||
        !player.ended || !Number.isFinite(player.duration) ||
        Math.abs(player.duration - player.currentTime) > 0.15) return;
      // Capture before the application handler can replace or remove this element.
      window.k67TestListeningEof = {
        document: performance.timeOrigin,
        playerGeneration,
        duration: player.duration,
        position: player.currentTime,
        playbackRate: player.playbackRate,
      };
    }, true);
  });
}

export async function waitForListeningEof(page, timeout) {
  const evidence = await page.waitForFunction(() => window.k67TestListeningEof, null, {timeout});
  try {
    return await evidence.jsonValue();
  } finally {
    await evidence.dispose();
  }
}
