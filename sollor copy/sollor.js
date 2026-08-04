const controlsHtml = ({ id, title }) => `
  <div class="plyr__controls">
    <div class="plyr__vertical-scrub" id="vs_wrap">
      <div class="plyr__vertical-scrub__center" id="vs_center">
        <div class="plyr__vertical-scrub__tape" id="vs_tape"></div>
        <div class="plyr__vertical-scrub__marker"></div>
      </div>
      <div class="plyr__vertical-scrub__time" id="vs_time">0:00</div>
      <div class="plyr__vertical-scrub__tooltip" id="vs_tip">0:00</div>
    </div>

    <button type="button" class="plyr__control" data-plyr="play" aria-label="Play, ${title}">
      <svg class="icon--pressed" role="presentation"><use xlink:href="#plyr-pause"></use></svg>
      <svg class="icon--not-pressed" role="presentation"><use xlink:href="#plyr-play"></use></svg>
      <span class="label--pressed plyr__tooltip" role="tooltip">Pause</span>
      <span class="label--not-pressed plyr__tooltip" role="tooltip">Play</span>
    </button>

    <div class="plyr__progress">
      <label for="seek${id}" class="plyr__sr-only">Seek</label>
      <input data-plyr="seek" id="seek${id}" type="range" min="0" max="100" step="0.01" value="0" aria-label="Seek">
      <progress class="plyr__progress__buffer" min="0" max="100" value="0">% buffered</progress>
      <span role="tooltip" class="plyr__tooltip">00:00</span>
    </div>

    <div class="plyr__time plyr__time--current" aria-label="Current time">00:00</div>
    <div class="plyr__time plyr__time--duration" aria-label="Duration">00:00</div>

    <button type="button" class="plyr__control" data-plyr="mute">
      <svg role="presentation"><use xlink:href="#plyr-muted"></use></svg>
      <span class="plyr__tooltip">Mute</span>
    </button>

    <div class="plyr__volume">
      <input data-plyr="volume" type="range" min="0" max="1" step="0.05" value="1" autocomplete="off" aria-label="Volume">
    </div>

    <button type="button" class="plyr__control" data-plyr="fullscreen">
      <svg role="presentation"><use xlink:href="#plyr-enter-fullscreen"></use></svg>
      <span class="plyr__tooltip">Fullscreen</span>
    </button>
  </div>
`;

const player = new Plyr('#player', {
  controls: controlsHtml,
  hideControls: true,
  tooltips: { controls: true, seek: true }
});

const mainVideo = document.getElementById('player');
const lowVideo = document.getElementById('player-low');
const shell = document.querySelector('.player-shell');

const fmt = (t) => {
  if (!t || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const END_GAP = 0.15;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const isBuffered = (time) => {
  if (!mainVideo?.buffered) return false;
  try {
    for (let i = 0; i < mainVideo.buffered.length; i++) {
      const start = mainVideo.buffered.start(i);
      const end = mainVideo.buffered.end(i);
      if (time >= start && time <= end) return true;
    }
  } catch {}
  return false;
};

const setLowRes = (on) => {
  if (!shell || !lowVideo) return;
  shell.classList.toggle('lowres-mode', on);
};

document.addEventListener('DOMContentLoaded', () => {
  const center = document.getElementById('vs_center');
  const tape = document.getElementById('vs_tape');
  const timeEl = document.getElementById('vs_time');
  const tip = document.getElementById('vs_tip');

  if (!center || !tape || !timeEl || !tip) return;

  let dragging = false;
  let startY = 0;
  let startOffset = 0;
  let offset = 0;
  let wasPlaying = false;

  const step = 10;
  const halfTravel = () => Math.max(40, Math.floor(center.clientHeight / 2) - 12);

  const maxTime = () => {
    const d = player.duration || 0;
    return Math.max(0, d - END_GAP);
  };

  const renderTape = () => {
    tape.innerHTML = '';
    const half = halfTravel();
    const total = Math.floor((half * 2) / step) + 1;
    const startIndex = -Math.floor(total / 2);

    tape.style.position = 'absolute';
    tape.style.left = '50%';
    tape.style.top = '50%';
    tape.style.width = '100%';
    tape.style.height = `${half * 2 + 40}px`;
    tape.style.transform = 'translate(-50%, -50%)';

    for (let i = 0; i < total; i++) {
      const tick = document.createElement('span');
      tick.className = 'plyr__vertical-scrub__tick';
      if (i % 2 === 0) tick.classList.add('plyr__vertical-scrub__tick--dim');
      tick.style.top = `calc(50% + ${(startIndex + i) * step}px)`;
      tape.appendChild(tick);
    }
  };

  const timeFromOffset = (off) => {
    const d = player.duration || 0;
    if (!d) return 0;
    const half = halfTravel();
    const p = clamp(off, 0, half * 2) / (half * 2);
    return clamp(p * d, 0, maxTime());
  };

  const syncFromTime = () => {
    const d = player.duration || 0;
    if (!d) return;
    const current = clamp(player.currentTime || 0, 0, maxTime());
    const half = halfTravel();
    const p = current / d;
    offset = p * (half * 2);
    tape.style.transform = `translate(-50%, calc(-50% + ${half - offset}px))`;
    timeEl.textContent = fmt(current);
    setLowRes(!isBuffered(current) || current >= d * 0.85);
  };

  const seekTo = (current) => {
    const target = clamp(current, 0, maxTime());
    player.currentTime = target;
    if (lowVideo) lowVideo.currentTime = target;
    setLowRes(!isBuffered(target) || target >= (player.duration || 0) * 0.85);
  };

  const moveByPointer = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = startY - y;
    const half = halfTravel();

    offset = clamp(startOffset + dy, 0, half * 2);
    const current = timeFromOffset(offset);

    tape.style.transform = `translate(-50%, calc(-50% + ${half - offset}px))`;
    tip.style.display = 'block';
    tip.textContent = fmt(current);

    seekTo(current);
  };

  const startDrag = (e) => {
    if (!player.duration) return;
    dragging = true;
    wasPlaying = !player.paused;
    player.pause();
    if (lowVideo) lowVideo.pause();
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startOffset = offset;
    moveByPointer(e);
    e.preventDefault();
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    tip.style.display = 'none';
    if (wasPlaying && (player.currentTime || 0) < maxTime()) {
      player.play();
      if (shell.classList.contains('lowres-mode') && lowVideo) lowVideo.play().catch(() => {});
    }
  };

  center.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', (e) => {
    if (dragging) moveByPointer(e);
  });
  document.addEventListener('mouseup', endDrag);

  center.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (dragging) moveByPointer(e);
  }, { passive: false });
  document.addEventListener('touchend', endDrag);

  player.on('loadedmetadata', () => {
    renderTape();
    syncFromTime();
  });

  player.on('ready', () => {
    renderTape();
    syncFromTime();
  });

  player.on('timeupdate', () => {
    if (!dragging) syncFromTime();
  });

  player.on('seeked', () => {
    if (!dragging) syncFromTime();
  });

  window.addEventListener('resize', () => {
    renderTape();
    syncFromTime();
  });

  renderTape();
  syncFromTime();
});