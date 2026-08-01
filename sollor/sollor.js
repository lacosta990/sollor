const verticalScrubHtml = `
  <div class="plyr__vertical-scrub__center" id="vs_center">
    <div class="plyr__vertical-scrub__tape" id="vs_tape"></div>
    <div class="plyr__vertical-scrub__marker"></div>
  </div>
  <div class="plyr__vertical-scrub__tooltip" id="vs_tip">0:00</div>
`;

function createVerticalScrubController({ mainVideo, player }) {
  const controls = player.elements.container.querySelector('.plyr__controls');
  if (!controls) return { init() {} };

  const scrubWrap = document.createElement('div');
  scrubWrap.className = 'plyr__vertical-scrub';
  scrubWrap.id = 'vs_wrap';
  scrubWrap.innerHTML = verticalScrubHtml;
  controls.appendChild(scrubWrap);

  const center = scrubWrap.querySelector('#vs_center');
  const tape = scrubWrap.querySelector('#vs_tape');
  const tip = scrubWrap.querySelector('#vs_tip');

  if (!center || !tape || !tip) return { init() {} };

  const STEP = 10;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const fmt = (t) => (!t || isNaN(t)) ? '0:00' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const maxTime = () => Math.max(0, mainVideo.duration || 0);

  let dragging = false;
  let wasPlaying = false;
  let startY = 0;
  let startOffset = 0;
  let offset = 0;
  let metaReady = false;

  const halfTravel = () => Math.max(40, Math.floor(center.clientHeight / 2) - 12);

  const offsetFromTime = (time) => {
    const d = mainVideo.duration || 0;
    if (!d) return 0;
    const half = halfTravel();
    return clamp((time / d) * (half * 2), 0, half * 2);
  };

  const timeFromOffset = (off) => {
    const d = mainVideo.duration || 0;
    if (!d) return 0;
    const half = halfTravel();
    return clamp((clamp(off, 0, half * 2) / (half * 2)) * d, 0, maxTime());
  };

  const renderTape = () => {
    const half = halfTravel();
    const total = Math.floor((half * 2) / STEP) + 1;
    const frag = document.createDocumentFragment();
    tape.innerHTML = '';
    tape.style.position = 'absolute';
    tape.style.left = '50%';
    tape.style.top = '50%';
    tape.style.width = '100%';
    tape.style.height = `${half * 2 + 40}px`;

    for (let i = 0; i < total; i++) {
      const tick = document.createElement('span');
      tick.className = 'plyr__vertical-scrub__tick';
      if (i % 2 === 0) tick.classList.add('plyr__vertical-scrub__tick--dim');
      tick.style.top = `calc(50% + ${(-Math.floor(total / 2) + i) * STEP}px)`;
      frag.appendChild(tick);
    }
    tape.appendChild(frag);
  };

  const applyTapePosition = () => {
    const half = halfTravel();
    tape.style.transform = `translate(-50%, calc(-50% + ${half - offset}px))`;
  };

  const seek = (time) => {
    mainVideo.currentTime = clamp(time, 0, maxTime());
  };

  const syncFromPlayer = () => {
    if (dragging) return;
    const current = mainVideo.currentTime || 0;
    offset = offsetFromTime(current);
    applyTapePosition();
  };

  const moveByPointer = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = startY - y;
    const half = halfTravel();
    offset = clamp(startOffset + dy, 0, half * 2);
    const targetTime = timeFromOffset(offset);

    applyTapePosition();
    tip.style.display = 'block';
    tip.textContent = fmt(targetTime);
    seek(targetTime);
  };

  const startDrag = (e) => {
    if (!metaReady || !mainVideo.duration) return;
    dragging = true;
    wasPlaying = !mainVideo.paused;
    player.pause();
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startOffset = offset;
    moveByPointer(e);
    e.preventDefault();
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    tip.style.display = 'none';
    if (wasPlaying) player.play();
  };

  const init = () => {
    const onMeta = () => {
      metaReady = true;
      renderTape();
      syncFromPlayer();
    };

    mainVideo.addEventListener('loadedmetadata', onMeta, { once: true });
    if (mainVideo.readyState >= 1) onMeta();

    center.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', (e) => {
      if (dragging) moveByPointer(e);
    }, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    player.on('timeupdate', syncFromPlayer);
    player.on('seeked', syncFromPlayer);

    window.addEventListener('resize', () => {
      renderTape();
      syncFromPlayer();
    });
  };

  return { init };
}

window.sollorCreatePlayer = function () {
  const player = new Plyr('#player', {
    hideControls: false,
    tooltips: { controls: true, seek: true },
    fullscreen: {
      enabled: true,
      fallback: true,
      iosNative: true
    },
    previewThumbnails: {
      enabled: true,
      src: 'https://cdn.plyr.io/static/demo/thumbs/240p.vtt'
    }
  });

  const lockLandscape = async () => {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (e) {}
  };

  const unlockOrientation = () => {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) {}
  };

  const forceLandscapeAfterFullscreen = () => {
    setTimeout(() => {
      lockLandscape();
    }, 50);
  };

  player.on('enterfullscreen', () => {
    forceLandscapeAfterFullscreen();
  });

  player.on('exitfullscreen', () => {
    unlockOrientation();
  });

  const fsBtn = player.elements.container.querySelector('[data-plyr="fullscreen"]');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      forceLandscapeAfterFullscreen();
    }, { passive: true });
  }

  const ctx = {
    player,
    mainVideo: document.getElementById('player')
  };

  const scrub = createVerticalScrubController(ctx);
  scrub.init();

  return player;
};

window.addEventListener('DOMContentLoaded', () => {
  window.sollorPlayer = window.sollorCreatePlayer();
});