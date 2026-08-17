import './style.css';

(function(){
  const video = document.getElementById('video');
  const demoBg = document.getElementById('demoBg');
  const permMsg = document.getElementById('permMsg');
  const viewfinder = document.getElementById('viewfinder');
  const cropGuide = document.getElementById('cropGuide');
  const shutter = document.getElementById('shutter');
  const flipBtn = document.getElementById('flipBtn');
  const flashBtn = document.getElementById('flashBtn');
  const flashOverlay = document.getElementById('flashOverlay');
  const photoLayer = document.getElementById('photoLayer');
  const tray = document.getElementById('tray');
  const focusReticle = document.getElementById('focusReticle');
  const hudClock = document.getElementById('hudClock');
  const expVal = document.getElementById('expVal');
  const filmHud = document.getElementById('filmHud');
  const filmPicker = document.getElementById('filmPicker');
  const filmPickerClose = document.getElementById('filmPickerClose');
  const filmPickerList = document.getElementById('filmPickerList');
  const filmPickerUnlock = document.getElementById('filmPickerUnlock');
  const unlockBtn = document.getElementById('unlockBtn');
  const viewer = document.getElementById('viewer');
  const viewerClose = document.getElementById('viewerClose');
  const viewerPolaroid = document.getElementById('viewerPolaroid');
  const frameSwatches = document.getElementById('frameSwatches');
  const styleChips = document.getElementById('styleChips');
  const saveBtn = document.getElementById('saveBtn');
  const saveVideoBtn = document.getElementById('saveVideoBtn');

  let flashOn = false;
  let facingMode = 'environment';
  let demoMode = false;
  let stream = null;
  let videoTrack = null;
  let focusRevertTimer = null;

  // ---------- filter model ----------
  // every look (blank paper, pale reveal, or a film's final grade) is a
  // plain params object so we can linearly interpolate between them for
  // the video export, and format to a real CSS filter string for the DOM
  function filterString(p){
    const { brightness = 1, contrast = 1, saturate = 1, sepia = 0, grayscale = 0, hueRotate = 0 } = p || {};
    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) grayscale(${grayscale}) hue-rotate(${hueRotate}deg)`;
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function lerpParams(a, b, t){
    return {
      brightness: lerp(a.brightness ?? 1, b.brightness ?? 1, t),
      contrast: lerp(a.contrast ?? 1, b.contrast ?? 1, t),
      saturate: lerp(a.saturate ?? 1, b.saturate ?? 1, t),
      sepia: lerp(a.sepia ?? 0, b.sepia ?? 0, t),
      grayscale: lerp(a.grayscale ?? 0, b.grayscale ?? 0, t),
      hueRotate: lerp(a.hueRotate ?? 0, b.hueRotate ?? 0, t),
    };
  }

  // the print starts almost black, then a dark, cool, ghostly image swims
  // up before the color and warmth of the stock bloom in
  const BLANK_LOOK = { brightness: 0.06, contrast: 1.2, saturate: 0, sepia: 0.3, hueRotate: 150 };
  const PALE_LOOK = { brightness: 0.55, contrast: 1.35, saturate: 0.15, sepia: 0.15, hueRotate: 60 };

  // real Polaroid film types — image-area aspect ratio (width/height)
  // shapes the print itself, and a grade suited to each stock's era
  const FILM_STOCKS = [
    { label: 'i-Type', aspect: 789/768, note: 'Now / Now+ / Lab · no battery', final: { brightness: 1, saturate: 1.05, contrast: 1.03, sepia: 0.04 } },
    { label: '600', aspect: 789/768, note: 'vintage 600-series · battery in pack', final: { brightness: 1.05, saturate: 1.15, contrast: 1.06, sepia: 0.07 } },
    { label: 'SX-70', aspect: 789/768, note: 'folding SX-70 · low ISO, needs more light', final: { brightness: 0.9, saturate: 0.82, contrast: 0.94, sepia: 0.22 } },
    { label: 'Go', aspect: 460/470, note: 'ultra-compact mini square', final: { brightness: 1.06, saturate: 1.2, contrast: 1.1 } },
    { label: '8×10', aspect: 8/10, note: 'large-format studio · varies by mask', final: { grayscale: 0.3, contrast: 1.12, brightness: 0.97, sepia: 0.05 } },
    { label: 'Spectra', aspect: 90/73, note: 'wide frame · discontinued', final: { brightness: 1.08, saturate: 0.7, contrast: 0.9, sepia: 0.15 }, premium: true },
    { label: 'Type 500', aspect: 73/54, note: 'Captiva / Joycam mini · discontinued', final: { saturate: 0.85, contrast: 0.95, brightness: 1.1, sepia: 0.18 }, premium: true },
    { label: 'Type 100', aspect: 5/4, note: 'peel-apart pack film · discontinued', final: { sepia: 0.5, contrast: 1.05, saturate: 0.7, brightness: 0.95 }, premium: true },
    { label: 'i-Zone', aspect: 24/36, note: 'sticker film · discontinued', final: { saturate: 1.35, contrast: 1.22, brightness: 1.05, hueRotate: -3 }, premium: true },
  ];
  let filmIndex = 0;

  let premiumUnlocked = false;
  try{ premiumUnlocked = localStorage.getItem('pp_premium_films') === '1'; }catch(e){}

  // border/caption styles, chosen per-photo in the viewer (not at shoot time)
  const FRAME_STYLES = [
    { label: 'Classic White', bg: '#f2ead9', ink: '#3a3226' },
    { label: 'Vintage Yellowed', bg: '#e4cf98', ink: '#4a3a1e' },
    { label: 'Sage', bg: '#c9d4bd', ink: '#33422f' },
    { label: 'Dusty Rose', bg: '#e3c3c2', ink: '#4a2c2b' },
    { label: 'Sky', bg: '#c7d6e0', ink: '#25333d' },
    { label: 'Amber', bg: '#e8c893', ink: '#4a3113' },
  ];

  // a finishing filter layered on top of the film's own baked-in grade —
  // chosen per-photo in the viewer, same as frame style
  const PHOTO_STYLES = [
    { label: 'Original', filter: {} },
    { label: 'Mono', filter: { grayscale: 1, contrast: 1.1 } },
    { label: 'Sepia', filter: { sepia: 0.75, contrast: 1.05, saturate: 0.9 } },
    { label: 'Vivid', filter: { saturate: 1.5, contrast: 1.15 } },
    { label: 'Faded', filter: { brightness: 1.12, saturate: 0.5, contrast: 0.85 } },
    { label: 'Noir', filter: { grayscale: 0.7, contrast: 1.35, brightness: 0.85 } },
  ];

  function renderFilmHud(){
    const film = FILM_STOCKS[filmIndex];
    filmHud.innerHTML = `${film.label}<br>${film.note} <span class="hud-caret">▾</span>`;
    filmHud.setAttribute('aria-label', `Choose film — currently ${film.label}, ${filmIndex + 1} of ${FILM_STOCKS.length}`);
  }

  function updateCropGuide(){
    const film = FILM_STOCKS[filmIndex];
    const vfRect = viewfinder.getBoundingClientRect();
    const maxW = vfRect.width * 0.86;
    const maxH = vfRect.height * 0.7;
    let w = maxW, h = w / film.aspect;
    if(h > maxH){ h = maxH; w = h * film.aspect; }
    cropGuide.style.width = w + 'px';
    cropGuide.style.height = h + 'px';
    cropGuide.style.left = ((vfRect.width - w) / 2) + 'px';
    cropGuide.style.top = ((vfRect.height - h) / 2) + 'px';
  }

  // maps the crop-guide's on-screen box back to native video pixel
  // coordinates, so the capture matches exactly what the guide showed —
  // accounting for the object-fit:cover scale/offset and, for the front
  // camera, the fact that the display is mirrored but the raw frame isn't
  function guideCropInVideoSpace(){
    const vw = video.videoWidth, vh = video.videoHeight;
    const vfRect = viewfinder.getBoundingClientRect();
    const cw = vfRect.width, ch = vfRect.height;
    if(!vw || !vh || !cw || !ch) return null;

    const scale = Math.max(cw / vw, ch / vh);
    const offsetX = (vw * scale - cw) / 2;
    const offsetY = (vh * scale - ch) / 2;

    const gx = parseFloat(cropGuide.style.left) || 0;
    const gy = parseFloat(cropGuide.style.top) || 0;
    const gw = parseFloat(cropGuide.style.width) || cw;
    const gh = parseFloat(cropGuide.style.height) || ch;

    let sx = (gx + offsetX) / scale;
    const sy = (gy + offsetY) / scale;
    const sw = gw / scale;
    const sh = gh / scale;

    if(facingMode === 'user'){
      sx = vw - sx - sw; // display is mirrored via CSS; the raw frame isn't
    }

    return {
      sx: Math.max(0, Math.min(sx, vw - sw)),
      sy: Math.max(0, Math.min(sy, vh - sh)),
      sw, sh,
    };
  }

  // maps a tap on the (possibly mirrored, object-fit:cover) viewfinder back
  // to a normalized [0,1] point in the raw sensor frame, for pointsOfInterest
  function videoPointFromViewfinderXY(x, y){
    const vw = video.videoWidth, vh = video.videoHeight;
    const vfRect = viewfinder.getBoundingClientRect();
    const cw = vfRect.width, ch = vfRect.height;
    if(!vw || !vh || !cw || !ch) return null;

    const scale = Math.max(cw / vw, ch / vh);
    const offsetX = (vw * scale - cw) / 2;
    const offsetY = (vh * scale - ch) / 2;

    let px = (x + offsetX) / scale;
    const py = (y + offsetY) / scale;
    if(facingMode === 'user') px = vw - px;

    return {
      x: Math.min(1, Math.max(0, px / vw)),
      y: Math.min(1, Math.max(0, py / vh)),
    };
  }

  // continuous autofocus is the resting state; a tap briefly locks focus
  // (and exposure, where the hardware supports it) to a single point,
  // then hands back to continuous — the same rhythm as a phone camera
  async function applyContinuousFocus(){
    if(!videoTrack || !videoTrack.getCapabilities) return;
    const caps = videoTrack.getCapabilities();
    if(!caps.focusMode || !caps.focusMode.includes('continuous')) return;
    try{ await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); }catch(e){}
  }

  async function applyManualFocus(point){
    if(!videoTrack || !videoTrack.getCapabilities) return;
    const caps = videoTrack.getCapabilities();
    if(!caps.focusMode || !caps.focusMode.includes('manual')) return;
    const advanced = { focusMode: 'manual' };
    if(caps.pointsOfInterest) advanced.pointsOfInterest = [{ x: point.x, y: point.y }];
    try{ await videoTrack.applyConstraints({ advanced: [advanced] }); }catch(e){}
    clearTimeout(focusRevertTimer);
    focusRevertTimer = setTimeout(applyContinuousFocus, 4000);
  }

  // isTap: a real user tap locks focus at that point (amber ring, snaps in);
  // otherwise it's the camera "waking up" and hunting for focus on its own
  function triggerFocus(x, y, isTap){
    focusReticle.style.left = x + 'px';
    focusReticle.style.top = y + 'px';
    focusReticle.classList.remove('show', 'auto', 'tap');
    void focusReticle.offsetWidth;
    focusReticle.classList.add('show', isTap ? 'tap' : 'auto');

    if(isTap && !demoMode){
      const point = videoPointFromViewfinderXY(x, y);
      if(point) applyManualFocus(point);
    }
  }

  function autofocusAtCenter(){
    const vfRect = viewfinder.getBoundingClientRect();
    triggerFocus(vfRect.width / 2, vfRect.height / 2, false);
  }

  function updateLivePreviewFilter(){
    const css = filterString(FILM_STOCKS[filmIndex].final);
    video.style.filter = css;
    demoBg.style.filter = css;
  }

  function onFilmChange(){
    renderFilmHud();
    updateCropGuide();
    updateLivePreviewFilter();
  }
  onFilmChange();
  window.addEventListener('resize', updateCropGuide);

  function pulseFilmHud(){
    filmHud.classList.remove('pulse');
    void filmHud.offsetWidth;
    filmHud.classList.add('pulse');
    setTimeout(()=> filmHud.classList.remove('pulse'), 500);
  }

  filmHud.addEventListener('click', (e)=>{
    e.stopPropagation();
    openFilmPicker();
  });

  function renderFilmPickerList(){
    filmPickerList.innerHTML = FILM_STOCKS.map((film, i)=>{
      const locked = film.premium && !premiumUnlocked;
      return `
        <button type="button" class="film-row${i === filmIndex ? ' active' : ''}${locked ? ' locked' : ''}" data-i="${i}">
          <span class="film-row-top">
            <span class="film-row-name">${film.label}</span>
            ${film.premium ? '<span class="pro-badge">PRO</span>' : ''}
            ${locked ? '<span class="film-row-lock">🔒</span>' : ''}
          </span>
          <span class="film-row-note">${film.note}</span>
        </button>
      `;
    }).join('');
  }

  function openFilmPicker(){
    renderFilmPickerList();
    filmPickerUnlock.hidden = true;
    filmPicker.classList.add('open');
  }
  function closeFilmPicker(){
    filmPicker.classList.remove('open');
  }

  filmPickerList.addEventListener('click', (e)=>{
    const row = e.target.closest('.film-row');
    if(!row) return;
    const i = Number(row.dataset.i);
    const film = FILM_STOCKS[i];
    if(film.premium && !premiumUnlocked){
      filmPickerUnlock.hidden = false;
      haptic(10);
      return;
    }
    filmIndex = i;
    onFilmChange();
    haptic(12);
    pulseFilmHud();
    closeFilmPicker();
  });

  unlockBtn.addEventListener('click', ()=>{
    premiumUnlocked = true;
    try{ localStorage.setItem('pp_premium_films', '1'); }catch(e){}
    renderFilmPickerList();
    filmPickerUnlock.hidden = true;
    haptic([10,30,10]);
  });

  filmPickerClose.addEventListener('click', (e)=>{ e.stopPropagation(); closeFilmPicker(); });
  filmPicker.addEventListener('click', (e)=>{ if(e.target === filmPicker) closeFilmPicker(); });

  // clock
  function tick(){
    const d = new Date();
    const s = d.toTimeString().slice(0,8);
    hudClock.innerHTML = '<span id="recDot"></span>' + s;
  }
  setInterval(tick, 1000); tick();

  // subtle exposure flicker for HUD realism
  setInterval(()=>{
    expVal.textContent = (Math.random()*0.6-0.3).toFixed(1);
  }, 1400);

  async function startCamera(){
    try{
      if(stream){ stream.getTracks().forEach(t=>t.stop()); }
      stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode: facingMode }, audio:false
      });
      video.srcObject = stream;
      video.classList.toggle('mirror', facingMode === 'user');
      demoMode = false;
      demoBg.style.display = 'none';
      video.style.display = 'block';
      permMsg.style.display = 'none';
      videoTrack = stream.getVideoTracks()[0];
      applyContinuousFocus();
      video.addEventListener('loadedmetadata', autofocusAtCenter, { once: true });
    }catch(e){
      demoMode = true;
      videoTrack = null;
      video.style.display = 'none';
      demoBg.style.display = 'block';
      permMsg.style.display = 'flex';
      requestAnimationFrame(autofocusAtCenter);
    }
  }
  startCamera();

  flipBtn.addEventListener('click', ()=>{
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if(!demoMode) startCamera();
  });

  flashBtn.addEventListener('click', ()=>{
    flashOn = !flashOn;
    flashBtn.classList.toggle('active', flashOn);
  });

  viewfinder.addEventListener('pointerdown', (e)=>{
    if(e.target.closest('#deck') || e.target === shutter || e.target.closest('#filmHud')) return;
    if(e.target.closest('.polaroid') || e.target.closest('.tray')) return;
    const rect = viewfinder.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    triggerFocus(x, y, true);
  });

  function haptic(ms){
    if(navigator.vibrate) navigator.vibrate(ms);
  }

  // ---------- shutter sound ----------
  // no real Polaroid recording to draw from, so the mechanical clack +
  // motor whir of an ejecting print is synthesized from oscillators/noise
  let audioCtx = null;
  function getAudioCtx(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    if(!audioCtx) audioCtx = new Ctx();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function noiseBuffer(ctx, duration){
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function playShutterSound(){
    const ctx = getAudioCtx();
    if(!ctx) return;
    const now = ctx.currentTime;

    // mechanical clack: a short decaying noise burst plus a low thunk
    const clickDur = 0.05;
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx, clickDur);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 1500;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.9, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDur);
    click.connect(clickFilter).connect(clickGain).connect(ctx.destination);
    click.start(now);
    click.stop(now + clickDur);

    const thunk = ctx.createOscillator();
    thunk.type = 'sine';
    thunk.frequency.setValueAtTime(180, now);
    thunk.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    const thunkGain = ctx.createGain();
    thunkGain.gain.setValueAtTime(0.5, now);
    thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thunk.connect(thunkGain).connect(ctx.destination);
    thunk.start(now);
    thunk.stop(now + 0.1);

    // motor whir as the print ejects, timed to the eject slide animation
    const whirStart = now + 0.08;
    const whirDur = 1.05;

    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(90, whirStart);
    motor.frequency.linearRampToValueAtTime(112, whirStart + 0.15);
    motor.frequency.setValueAtTime(105, whirStart + whirDur - 0.2);
    motor.frequency.exponentialRampToValueAtTime(40, whirStart + whirDur);
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 900;
    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(0.0001, whirStart);
    motorGain.gain.exponentialRampToValueAtTime(0.22, whirStart + 0.06);
    motorGain.gain.setValueAtTime(0.22, whirStart + whirDur - 0.25);
    motorGain.gain.exponentialRampToValueAtTime(0.001, whirStart + whirDur);
    motor.connect(motorFilter).connect(motorGain).connect(ctx.destination);
    motor.start(whirStart);
    motor.stop(whirStart + whirDur);

    const motorNoise = ctx.createBufferSource();
    motorNoise.buffer = noiseBuffer(ctx, whirDur);
    const motorNoiseFilter = ctx.createBiquadFilter();
    motorNoiseFilter.type = 'bandpass';
    motorNoiseFilter.frequency.value = 1200;
    motorNoiseFilter.Q.value = 0.7;
    const motorNoiseGain = ctx.createGain();
    motorNoiseGain.gain.setValueAtTime(0.0001, whirStart);
    motorNoiseGain.gain.exponentialRampToValueAtTime(0.05, whirStart + 0.06);
    motorNoiseGain.gain.setValueAtTime(0.05, whirStart + whirDur - 0.25);
    motorNoiseGain.gain.exponentialRampToValueAtTime(0.001, whirStart + whirDur);
    motorNoise.connect(motorNoiseFilter).connect(motorNoiseGain).connect(ctx.destination);
    motorNoise.start(whirStart);
    motorNoise.stop(whirStart + whirDur);
  }

  function loadImage(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=> resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // canvas text only picks up a webfont once it's actually finished loading —
  // this makes sure the marker face is ready before any export draws on it
  let markerFontReady = null;
  function ensureMarkerFont(){
    if(!markerFontReady){
      markerFontReady = (document.fonts && document.fonts.load)
        ? document.fonts.load("32px 'Permanent Marker'").catch(()=>{})
        : Promise.resolve();
    }
    return markerFontReady;
  }

  function captureFrame(aspect){
    // keep roughly the same pixel budget across shapes, just reflow it
    // to the chosen film's real width/height proportions
    const targetArea = 480 * 640;
    const h = Math.round(Math.sqrt(targetArea / aspect));
    const w = Math.round(aspect * h);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // a real flash brightens and washes out whatever gets drawn next —
    // ctx.filter applies to every draw call below, demo mode included
    if(flashOn){
      ctx.filter = 'brightness(1.55) contrast(0.88) saturate(0.82)';
    }

    if(demoMode){
      // generate a moody procedural "photo" as a stand-in
      const g = ctx.createLinearGradient(0,0,0,h);
      const palettes = [
        ['#3a4f3f','#1c2620'], ['#4a3626','#221812'], ['#2c3a4a','#101820'], ['#4a3a2c','#1e150e']
      ];
      const p = palettes[Math.floor(Math.random()*palettes.length)];
      g.addColorStop(0,p[0]); g.addColorStop(1,p[1]);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 0.5;
      for(let i=0;i<40;i++){
        ctx.beginPath();
        ctx.arc(Math.random()*w, Math.random()*h, Math.random()*60+10, 0, Math.PI*2);
        ctx.fillStyle = Math.random() > 0.5 ? '#00000030' : '#ffffff10';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      if(facingMode === 'user'){
        ctx.translate(w,0); ctx.scale(-1,1);
      }
      // capture exactly the region the crop-guide was showing, not just
      // any center-crop at the right aspect ratio — what you see boxed in
      // the viewfinder is what you get, framing included
      const crop = guideCropInVideoSpace();
      if(crop){
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
      } else {
        // fallback for the rare case video metadata isn't ready yet:
        // a plain center-crop to the target aspect ratio
        const vw = video.videoWidth, vh = video.videoHeight;
        if(vw > 0 && vh > 0){
          const videoAspect = vw / vh;
          let sx, sy, sw, sh;
          if(videoAspect > aspect){
            sh = vh; sw = vh * aspect; sx = (vw - sw) / 2; sy = 0;
          } else {
            sw = vw; sh = vw / aspect; sx = 0; sy = (vh - sh) / 2;
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        } else {
          ctx.drawImage(video, 0, 0, w, h);
        }
      }
    }
    return canvas;
  }

  // bakes a film's CSS filter into actual pixels (Canvas 2D's `filter`
  // accepts the same syntax) so the saved/exported image matches what
  // the animation settles into, not just the live on-screen look
  function renderFilmVariant(sourceCanvas, filterCss){
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    ctx.filter = filterCss;
    ctx.drawImage(sourceCanvas, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  let photoCount = 0;

  shutter.addEventListener('click', ()=>{
    haptic(20);
    playShutterSound();
    enableMotionOnce();
    if(flashOn){ flashOverlay.classList.remove('fire'); void flashOverlay.offsetWidth; flashOverlay.classList.add('fire'); }

    const film = FILM_STOCKS[filmIndex];
    const canvas = captureFrame(film.aspect);
    const rawUrl = canvas.toDataURL('image/jpeg', 0.9);
    const finalUrl = renderFilmVariant(canvas, filterString(film.final));

    photoCount++;
    const record = {
      id: photoCount,
      rawUrl,
      finalUrl,
      film,
      caption: `${new Date().toLocaleDateString()} · ${film.label}`,
      captionTilt: (Math.random() * 4 - 2).toFixed(1),
      frame: FRAME_STYLES[0],
      style: PHOTO_STYLES[0],
    };
    ejectPolaroid(record);
  });

  // photos still resting in the viewfinder, mid chemical development —
  // shaking the "print" (or the phone) fast-forwards these to their final look
  const developingPolaroids = new Map();

  function fastForwardAll(){
    if(developingPolaroids.size === 0) return;
    haptic([15,40,15]);
    developingPolaroids.forEach((dev)=>{
      dev.timers.forEach(clearTimeout);
      dev.img.style.transition = 'filter 0.7s ease-out';
      dev.img.style.filter = filterString(dev.film.final);
      dev.grain.style.transition = 'opacity 0.6s ease-out';
      dev.grain.style.opacity = '0';
      dev.caption.style.transition = 'opacity 0.6s ease';
      dev.caption.style.opacity = '0.8';
    });
    developingPolaroids.clear();
  }

  let motionEnabled = false;
  function enableMotionOnce(){
    if(motionEnabled) return;
    motionEnabled = true;
    if(typeof DeviceMotionEvent === 'undefined') return;
    if(typeof DeviceMotionEvent.requestPermission === 'function'){
      DeviceMotionEvent.requestPermission().then((state)=>{
        if(state === 'granted') window.addEventListener('devicemotion', onMotion);
      }).catch(()=>{});
    } else {
      window.addEventListener('devicemotion', onMotion);
    }
  }

  let lastAccel = null;
  let lastShakeAt = 0;
  function onMotion(e){
    const a = e.accelerationIncludingGravity || e.acceleration;
    if(!a || a.x === null || a.x === undefined) return;
    if(lastAccel){
      const delta = Math.abs(a.x - lastAccel.x) + Math.abs(a.y - lastAccel.y) + Math.abs(a.z - lastAccel.z);
      const now = Date.now();
      if(delta > 28 && now - lastShakeAt > 1200){
        lastShakeAt = now;
        fastForwardAll();
      }
    }
    lastAccel = a;
  }

  function ejectPolaroid(record){
    const { rawUrl, film } = record;
    const vfRect = viewfinder.getBoundingClientRect();
    const polWidth = Math.min(vfRect.width * 0.78, 320);

    const pol = document.createElement('div');
    pol.className = 'polaroid';
    pol.style.width = polWidth + 'px';
    const startLeft = vfRect.width/2 - polWidth/2;
    pol.style.left = startLeft + 'px';
    pol.style.top = (vfRect.height - 40) + 'px';
    pol.style.transform = 'scale(0.94) rotate(0deg)';
    pol.style.opacity = '0';
    pol.style.transition = 'top 0.9s cubic-bezier(.2,.8,.2,1), left 0.9s cubic-bezier(.2,.8,.2,1), transform 0.9s cubic-bezier(.2,.8,.2,1), opacity 0.3s ease';
    pol.style.zIndex = 20 + record.id;

    pol.innerHTML = `
      <div class="shot" style="aspect-ratio: ${film.aspect};">
        <img src="${rawUrl}" style="filter: ${filterString(BLANK_LOOK)};">
        <div class="develop-grain" style="opacity:0.95;"></div>
      </div>
      <div class="caption" style="transform: rotate(${record.captionTilt}deg);">${record.caption}</div>
      <div class="drag-hint">slide me aside →</div>
    `;
    photoLayer.appendChild(pol);

    const restY = vfRect.height * 0.4;
    const restRot = (Math.random()*6 - 3).toFixed(1);

    requestAnimationFrame(()=>{
      pol.style.opacity = '1';
      pol.style.top = restY + 'px';
      pol.style.transform = `scale(1) rotate(${restRot}deg)`;
    });

    // ---- phased chemical development, ~29s total, like real instant film ----
    // phase 1: a nearly black rectangle, chemicals spreading under the surface
    // phase 2: a dark, cool, ghostly image swims up out of the black
    // phase 3: color and warmth slowly bloom in as the dyes finish coupling
    const img = pol.querySelector('img');
    const grain = pol.querySelector('.develop-grain');
    const caption = pol.querySelector('.caption');
    const dragHint = pol.querySelector('.drag-hint');

    setTimeout(()=>{ dragHint.style.opacity = '0.7'; }, 1000);
    setTimeout(()=>{ dragHint.style.opacity = '0'; }, 4000);

    const t1 = setTimeout(()=>{
      // phase 2 starts
      img.style.transition = 'filter 10.5s cubic-bezier(.33,.1,.4,1)';
      img.style.filter = filterString(PALE_LOOK);
      grain.style.transition = 'opacity 10.5s ease-out';
      grain.style.opacity = '0.5';
      haptic(8);
    }, 2600);

    const t2 = setTimeout(()=>{
      // phase 3: color blooms in slowly, like real dye coupling — settling
      // into whatever stock was loaded when the shot was taken
      img.style.transition = 'filter 15s cubic-bezier(.16,.5,.3,1)';
      img.style.filter = filterString(film.final);
      grain.style.transition = 'opacity 7s ease-out';
      grain.style.opacity = '0';
    }, 2600 + 10500);

    const t3 = setTimeout(()=>{
      caption.style.transition = 'opacity 2s ease';
      caption.style.opacity = '0.8';
      haptic([10,40,10]);
      developingPolaroids.delete(pol);
    }, 2600 + 10500 + 15000);

    developingPolaroids.set(pol, { img, grain, caption, film, timers: [t1, t2, t3] });

    enableDrag(pol, record);
  }

  function enableDrag(pol, record){
    let dragging = false, moved = false;
    let startX=0, startY=0, startLeft=0, startTop=0;

    pol.addEventListener('pointerdown', (e)=>{
      dragging = true; moved = false;
      pol.setPointerCapture(e.pointerId);
      pol.classList.add('dragging');
      pol.style.transition = 'none';
      pol.style.zIndex = 999;
      startX = e.clientX; startY = e.clientY;
      startLeft = parseFloat(pol.style.left) || 0;
      startTop = parseFloat(pol.style.top) || 0;
    });

    pol.addEventListener('pointermove', (e)=>{
      if(!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if(Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      pol.style.left = (startLeft + dx) + 'px';
      pol.style.top = (startTop + dy) + 'px';
    });

    function endDrag(e){
      if(!dragging) return;
      dragging = false;
      pol.classList.remove('dragging');
      pol.style.transition = 'left 0.3s ease, top 0.3s ease, transform 0.3s ease';

      const trayRect = tray.getBoundingClientRect();
      const vfRect = viewfinder.getBoundingClientRect();
      const polRect = pol.getBoundingClientRect();
      const droppedInTray = polRect.top + polRect.height*0.5 > trayRect.top;

      if(droppedInTray){
        sendToTray(pol, record);
      } else if(!moved){
        // treat as a tap: nudge it aside a little so the next shot has room,
        // but only send to tray on a real tap-to-file gesture (double meaning avoided:
        // a plain tap just settles it back down)
        pol.style.left = Math.min(Math.max(parseFloat(pol.style.left), 8), vfRect.width - pol.offsetWidth - 8) + 'px';
      } else {
        // keep it wherever the person moved it, clamped inside the viewfinder
        const clampedLeft = Math.min(Math.max(parseFloat(pol.style.left), 4), vfRect.width - pol.offsetWidth - 4);
        const clampedTop = Math.min(Math.max(parseFloat(pol.style.top), 4), vfRect.height - pol.offsetHeight - 4);
        pol.style.left = clampedLeft + 'px';
        pol.style.top = clampedTop + 'px';
      }
    }
    pol.addEventListener('pointerup', endDrag);
    pol.addEventListener('pointercancel', endDrag);
  }

  function sendToTray(pol, record){
    if(!pol.parentElement) return;
    const dev = developingPolaroids.get(pol);
    if(dev){ dev.timers.forEach(clearTimeout); developingPolaroids.delete(pol); }

    const trayRect = tray.getBoundingClientRect();
    const polRect = pol.getBoundingClientRect();
    const dx = (trayRect.left + trayRect.width*0.15) - polRect.left;
    const dy = (trayRect.top) - polRect.top;

    pol.style.transition = 'transform 0.5s cubic-bezier(.4,0,.2,1), left 0.5s cubic-bezier(.4,0,.2,1), top 0.5s cubic-bezier(.4,0,.2,1), opacity 0.5s ease 0.1s';
    pol.style.left = (parseFloat(pol.style.left) + dx) + 'px';
    pol.style.top = (parseFloat(pol.style.top) + dy) + 'px';
    pol.style.transform = `scale(0.22) rotate(${(Math.random()*10-5).toFixed(1)}deg)`;
    pol.style.opacity = '0';

    setTimeout(()=>{
      pol.remove();
      addThumb(record);
    }, 520);
  }

  function addThumb(record){
    const t = document.createElement('div');
    t.className = 'tray-thumb';
    const rot = (Math.random()*8-4).toFixed(1);
    t.style.transform = `rotate(${rot}deg)`;
    t.innerHTML = `<div class="shot"><img src="${record.finalUrl}"></div>`;
    t.addEventListener('click', ()=> openViewer(record));
    tray.appendChild(t);
    tray.scrollLeft = tray.scrollWidth;

    // file it away in the print box automatically, with a little "settling in" delay
    setTimeout(()=>{
      flashDrawerTab();
      addToDrawer(record);
    }, 350);
  }

  function flashDrawerTab(){
    if(!drawerOpen){
      drawerTab.classList.add('dragover');
      setTimeout(()=> drawerTab.classList.remove('dragover'), 500);
    }
    haptic([8,30,8]);
  }

  // ---------- drawer ----------
  const drawer = document.getElementById('drawer');
  const drawerScrim = document.getElementById('drawerScrim');
  const drawerTab = document.getElementById('drawerTab');
  const drawerGrid = document.getElementById('drawerGrid');
  const drawerEmpty = document.getElementById('drawerEmpty');
  const drawerCount = document.getElementById('drawerCount');
  let drawerOpen = false;
  let storedPrints = [];

  function setDrawer(open){
    drawerOpen = open;
    drawer.classList.toggle('open', open);
    drawerScrim.classList.toggle('open', open);
    drawerTab.classList.toggle('open', open);
  }
  drawerTab.addEventListener('click', ()=> setDrawer(!drawerOpen));
  drawerScrim.addEventListener('click', ()=> setDrawer(false));

  function refreshDrawer(){
    drawerCount.textContent = storedPrints.length;
    drawerEmpty.style.display = storedPrints.length ? 'none' : 'block';
  }

  function addToDrawer(record){
    storedPrints.push(record);
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = `<div class="shot"><img src="${record.finalUrl}"></div>`;
    item.addEventListener('click', ()=> openViewer(record));
    drawerGrid.appendChild(item);
    refreshDrawer();
  }

  // dragging a tray thumbnail up (past the tab / into the drawer) files it away
  // dragging a tray thumbnail is no longer required to file it — kept simple, tap just views it

  // ---------- viewer: customize (caption + frame style) and export ----------
  let currentRecord = null;

  function applyFrameToViewer(record){
    viewerPolaroid.style.background = record.frame.bg;
    const cap = viewerPolaroid.querySelector('.caption');
    if(cap) cap.style.color = record.frame.ink;
  }

  function applyStyleToViewer(record){
    const img = viewerPolaroid.querySelector('.shot img');
    if(img) img.style.filter = filterString(record.style.filter);
  }

  function renderFrameSwatches(record){
    frameSwatches.innerHTML = FRAME_STYLES.map((f, i) => `
      <button type="button" class="swatch${f === record.frame ? ' active' : ''}" data-i="${i}" style="background:${f.bg}" aria-label="${f.label}" title="${f.label}"></button>
    `).join('');
  }

  function renderStyleChips(record){
    styleChips.innerHTML = PHOTO_STYLES.map((s, i) => `
      <button type="button" class="style-chip${s === record.style ? ' active' : ''}" data-i="${i}">${s.label}</button>
    `).join('');
  }

  frameSwatches.addEventListener('click', (e)=>{
    const btn = e.target.closest('.swatch');
    if(!btn || !currentRecord) return;
    e.stopPropagation();
    currentRecord.frame = FRAME_STYLES[Number(btn.dataset.i)];
    applyFrameToViewer(currentRecord);
    renderFrameSwatches(currentRecord);
    haptic(10);
  });

  styleChips.addEventListener('click', (e)=>{
    const btn = e.target.closest('.style-chip');
    if(!btn || !currentRecord) return;
    e.stopPropagation();
    currentRecord.style = PHOTO_STYLES[Number(btn.dataset.i)];
    applyStyleToViewer(currentRecord);
    renderStyleChips(currentRecord);
    haptic(10);
  });

  function openViewer(record){
    currentRecord = record;
    viewerPolaroid.innerHTML = `
      <div class="shot" style="aspect-ratio: ${record.film.aspect};"><img src="${record.finalUrl}"></div>
      <div class="caption" contenteditable="true" spellcheck="false" style="opacity:1; transform: rotate(${record.captionTilt}deg);">${record.caption}</div>
    `;
    applyFrameToViewer(record);
    renderFrameSwatches(record);
    applyStyleToViewer(record);
    renderStyleChips(record);

    const cap = viewerPolaroid.querySelector('.caption');
    cap.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); cap.blur(); }
    });
    cap.addEventListener('input', ()=>{
      if(cap.textContent.length > 50) cap.textContent = cap.textContent.slice(0, 50);
    });
    cap.addEventListener('blur', ()=>{
      currentRecord.caption = cap.textContent.trim() || `${new Date().toLocaleDateString()} · ${record.film.label}`;
    });

    viewer.style.display = 'flex';
  }
  viewer.addEventListener('click', (e)=>{ if(e.target === viewer) viewer.style.display = 'none'; });
  viewerClose.addEventListener('click', (e)=>{ e.stopPropagation(); viewer.style.display = 'none'; });

  function filenameFor(record, ext){
    const slug = record.film.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `polaroid-${slug}-${record.id}.${ext}`;
  }

  async function shareOrDownload(blob, filename, mimeType){
    // when embedded as a Claude Artifact, plain <a download> links and
    // blob URLs are inert for viewers — the host only lets a save reach
    // them through this capability, which shows a real save prompt
    if(window.claude && window.claude.use){
      try{
        const downloads = await window.claude.use('downloads');
        if(downloads){
          await downloads.save({ filename, data: blob });
          return;
        }
      }catch(err){
        if(err && (err.code === 'declined' || err.code === 'rate_limited')) return; // viewer said no / already asking
        // otherwise fall through to the web-standard paths below
      }
    }

    if(navigator.canShare){
      try{
        const file = new File([blob], filename, { type: mimeType });
        if(navigator.canShare({ files: [file] })){
          await navigator.share({ files: [file], title: 'Polaroid Cam' });
          return;
        }
      }catch(err){
        if(err && err.name === 'AbortError') return; // user dismissed the share sheet
        // otherwise fall through to a direct download below
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
  }

  // renders the full framed print (border + photo + caption) to a canvas —
  // this is the "customized" result that actually gets shared, not just the bare photo
  async function renderPolaroidCard(record){
    const outW = 720;
    const sidePad = Math.round(outW * 0.045);
    const topPad = sidePad;
    const bottomPad = Math.round(outW * 0.17);
    const photoW = outW - sidePad * 2;
    const photoH = Math.round(photoW / record.film.aspect);
    const cardH = topPad + photoH + bottomPad;

    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = cardH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = record.frame.bg;
    if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(0, 0, outW, cardH, 7); ctx.fill(); }
    else ctx.fillRect(0, 0, outW, cardH);

    const [img] = await Promise.all([loadImage(record.finalUrl), ensureMarkerFont()]);
    ctx.filter = filterString(record.style.filter);
    ctx.drawImage(img, sidePad, topPad, photoW, photoH);
    ctx.filter = 'none'; // the style filter shouldn't bleed into the caption below

    drawCaption(ctx, record, outW / 2, topPad + photoH + bottomPad * 0.55, outW - sidePad * 2);

    return new Promise((resolve)=> canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }

  // draws the caption like it was written in marker on the print's
  // border — same font and hand-tilt as the on-screen version
  function drawCaption(ctx, record, x, y, maxWidth){
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Number(record.captionTilt) || 0) * Math.PI / 180);
    ctx.fillStyle = record.frame.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = Math.round(maxWidth * 0.055);
    const text = record.caption || '';
    ctx.font = `${fontSize}px 'Permanent Marker', cursive`;
    while(ctx.measureText(text).width > maxWidth && fontSize > 10){
      fontSize -= 1;
      ctx.font = `${fontSize}px 'Permanent Marker', cursive`;
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  saveBtn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    if(!currentRecord) return;
    haptic([10,30,10]);
    const blob = await renderPolaroidCard(currentRecord);
    await shareOrDownload(blob, filenameFor(currentRecord, 'jpg'), 'image/jpeg');
  });

  // records a short, story/reel-friendly replay of the develop animation,
  // framed in the currently chosen border style and caption
  async function exportDevelopVideo(record){
    if(!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream){
      alert("Video export isn't supported in this browser — try Save Image instead.");
      return;
    }
    haptic([10,30,10]);

    const outW = 720, outH = 1280;
    const cardW = Math.round(outW * 0.72);
    const sidePad = Math.round(cardW * 0.045);
    const topPad = sidePad;
    const bottomPad = Math.round(cardW * 0.17);
    const photoW = cardW - sidePad * 2;
    const photoH = Math.round(photoW / record.film.aspect);
    const cardH = topPad + photoH + bottomPad;
    const cardX = Math.round((outW - cardW) / 2);
    const cardY = Math.round((outH - cardH) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    const [img] = await Promise.all([loadImage(record.rawUrl), ensureMarkerFont()]);

    function drawFrame(progress){
      const bgGrad = ctx.createLinearGradient(0, 0, 0, outH);
      bgGrad.addColorStop(0, '#17140f');
      bgGrad.addColorStop(1, '#0b0a08');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, outW, outH);

      ctx.fillStyle = record.frame.bg;
      if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 6); ctx.fill(); }
      else ctx.fillRect(cardX, cardY, cardW, cardH);

      const params = progress < 0.35
        ? lerpParams(BLANK_LOOK, PALE_LOOK, progress / 0.35)
        : lerpParams(PALE_LOOK, record.film.final, (progress - 0.35) / 0.65);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cardX + sidePad, cardY + topPad, photoW, photoH);
      ctx.clip();
      ctx.filter = `${filterString(params)} ${filterString(record.style.filter)}`;
      ctx.drawImage(img, cardX + sidePad, cardY + topPad, photoW, photoH);
      ctx.restore();

      drawCaption(ctx, record, cardX + cardW / 2, cardY + topPad + photoH + bottomPad * 0.55, cardW - sidePad * 2);
    }

    drawFrame(0);
    const stream = canvas.captureStream(24);
    // iOS Safari's MediaRecorder can't encode WebM at all — only MP4/H.264 —
    // so without an MP4 path first, export silently fails on iPhone and the
    // clip never reaches the share sheet's "Save Video" (camera roll) option
    const CANDIDATE_TYPES = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = CANDIDATE_TYPES.find(t => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t))
      || 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const chunks = [];
    recorder.ondataavailable = (e)=>{ if(e.data.size) chunks.push(e.data); };

    const duration = 5000, holdBlank = 400;
    const startTime = performance.now();

    return new Promise((resolve)=>{
      recorder.onstop = async ()=>{
        const blob = new Blob(chunks, { type: recorder.mimeType });
        await shareOrDownload(blob, filenameFor(record, ext), recorder.mimeType);
        resolve();
      };
      recorder.start();
      function tick(){
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, Math.max(0, (elapsed - holdBlank) / (duration - holdBlank)));
        drawFrame(elapsed < holdBlank ? 0 : t);
        if(elapsed < duration){
          requestAnimationFrame(tick);
        } else {
          drawFrame(1);
          recorder.stop();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  saveVideoBtn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    if(!currentRecord) return;
    await exportDevelopVideo(currentRecord);
  });

})();
