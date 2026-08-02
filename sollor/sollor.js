const verticalScrubHtml = `
  <div class="plyr__vertical-scrub__center" id="vs_center">
    <div class="plyr__vertical-scrub__tape" id="vs_tape"></div>
    <div class="plyr__vertical-scrub__marker"></div>
  </div>
  <div class="plyr__vertical-scrub__tooltip" id="vs_tip">0:00</div>
`;

function isMobileTablet() {
  return window.matchMedia('(max-width: 1024px)').matches;
}

function createVerticalScrubController({ mainVideo, player }) {
  const controls = player.elements.container.querySelector('.plyr__controls');
  if (!controls) return { init() {}, scrubWrap: null };

  const scrubWrap = document.createElement('div');
  scrubWrap.className = 'plyr__vertical-scrub scrub--right';
  scrubWrap.id = 'vs_wrap';
  scrubWrap.innerHTML = verticalScrubHtml;
  controls.appendChild(scrubWrap);

  const center = scrubWrap.querySelector('#vs_center');
  const tape = scrubWrap.querySelector('#vs_tape');
  const tip = scrubWrap.querySelector('#vs_tip');

  if (!center || !tape || !tip) return { init() {}, scrubWrap };

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

  return { init, scrubWrap };
}

function createMobileLayout(player, scrubWrap) {
  if (!isMobileTablet()) return;

  const controls = player.elements.container.querySelector('.plyr__controls');
  if (!controls) return;

  const existingSettings = controls.querySelector('[data-plyr="settings"]');
  const existingPip = controls.querySelector('[data-plyr="pip"]');
  const existingFullscreen = controls.querySelector('[data-plyr="fullscreen"]');
  const existingMute = controls.querySelector('[data-plyr="mute"]');
  const existingCaptions = controls.querySelector('[data-plyr="captions"]');
  const existingProgress = controls.querySelector('.plyr__progress__container');

  const scrubRow = document.createElement('div');
  scrubRow.className = 'plyr__mobile-scrub-row';

  const buttonsRow = document.createElement('div');
  buttonsRow.className = 'plyr__mobile-vertical-panel';

  const progressRow = document.createElement('div');
  progressRow.className = 'plyr__mobile-progress-row';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'plyr__control plyr__control--toggle-scrub';
  toggleBtn.setAttribute('aria-label', 'Переключить положение скраббара');
  toggleBtn.setAttribute('title', 'Переключить положение скраббара');
  toggleBtn.textContent = '⇄';

  scrubRow.appendChild(scrubWrap);

  buttonsRow.appendChild(toggleBtn);
  if (existingMute) buttonsRow.appendChild(existingMute);
  if (existingCaptions) buttonsRow.appendChild(existingCaptions);
  if (existingSettings) buttonsRow.appendChild(existingSettings);
  if (existingPip) buttonsRow.appendChild(existingPip);
  if (existingFullscreen) buttonsRow.appendChild(existingFullscreen);

  if (existingProgress) progressRow.appendChild(existingProgress);

  controls.appendChild(scrubRow);
  controls.appendChild(buttonsRow);
  controls.appendChild(progressRow);

  let currentSide = 'right';
  toggleBtn.addEventListener('click', () => {
    currentSide = currentSide === 'right' ? 'left' : 'right';
    scrubWrap.classList.remove('scrub--left', 'scrub--right');
    scrubWrap.classList.add(currentSide === 'left' ? 'scrub--left' : 'scrub--right');
  });
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
    controls: [
      'play-large',
      'play',
      'progress',
      'current-time',
      'mute',
      'volume',
      'captions',
      'settings',
      'pip',
      'fullscreen'
    ]
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

  const mainVideo = document.getElementById('player');
  const scrub = createVerticalScrubController({ mainVideo, player });
  scrub.init();

  if (scrub.scrubWrap) {
    createMobileLayout(player, scrub.scrubWrap);
  }

  return player;
};

window.addEventListener('DOMContentLoaded', () => {
  window.sollorPlayer = window.sollorCreatePlayer();
});