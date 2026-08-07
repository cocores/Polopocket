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
  const saveBtn = document.getElementById('saveBtn');
  const saveVideoBtn = document.getElementById('saveVideoBtn');

  let flashOn = false;
  let facingMode = 'user';
  let demoMode = false;
  let stream = null;

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

  // real instant film starts as a nearly blank white rectangle, then the
  // image swims up pale before the color and warmth of the stock bloom in
  const BLANK_LOOK = { brightness: 2.4, contrast: 0.22, saturate: 0 };
  const PALE_LOOK = { brightness: 1.4, contrast: 0.65, saturate: 0.3, sepia: 0.05 };

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
    }catch(e){
      demoMode = true;
      video.style.display = 'none';
      demoBg.style.display = 'block';
      permMsg.style.display = 'flex';
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
    const rect = viewfinder.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    focusReticle.style.left = x + 'px';
    focusReticle.style.top = y + 'px';
    focusReticle.classList.remove('show');
    void focusReticle.offsetWidth;
    focusReticle.classList.add('show');
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

  function captureFrame(aspect){
    // keep roughly the same pixel budget across shapes, just reflow it
    // to the chosen film's real width/height proportions
    const targetArea = 480 * 640;
    const h = Math.round(Math.sqrt(targetArea / aspect));
    const w = Math.round(aspect * h);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

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
      ctx.drawImage(video, 0, 0, w, h);
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
      frame: FRAME_STYLES[0],
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
      <div class="caption">${record.caption}</div>
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

    // ---- phased chemical development, ~24s total, like real instant film ----
    // phase 1: a nearly blank white rectangle, chemicals spreading under the surface
    // phase 2: a pale, hazy image swims up out of the white
    // phase 3: color and warmth slowly bloom in as the dyes finish coupling
    const img = pol.querySelector('img');
    const grain = pol.querySelector('.develop-grain');
    const caption = pol.querySelector('.caption');
    const dragHint = pol.querySelector('.drag-hint');

    setTimeout(()=>{ dragHint.style.opacity = '0.7'; }, 1000);
    setTimeout(()=>{ dragHint.style.opacity = '0'; }, 4000);

    const t1 = setTimeout(()=>{
      // phase 2 starts
      img.style.transition = 'filter 9s cubic-bezier(.33,.1,.4,1)';
      img.style.filter = filterString(PALE_LOOK);
      grain.style.transition = 'opacity 9s ease-out';
      grain.style.opacity = '0.5';
      haptic(8);
    }, 2200);

    const t2 = setTimeout(()=>{
      // phase 3: color blooms in slowly, like real dye coupling — settling
      // into whatever stock was loaded when the shot was taken
      img.style.transition = 'filter 13s cubic-bezier(.16,.5,.3,1)';
      img.style.filter = filterString(film.final);
      grain.style.transition = 'opacity 6s ease-out';
      grain.style.opacity = '0';
    }, 2200 + 9000);

    const t3 = setTimeout(()=>{
      caption.style.transition = 'opacity 2s ease';
      caption.style.opacity = '0.8';
      haptic([10,40,10]);
      developingPolaroids.delete(pol);
    }, 2200 + 9000 + 13000);

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

  function renderFrameSwatches(record){
    frameSwatches.innerHTML = FRAME_STYLES.map((f, i) => `
      <button type="button" class="swatch${f === record.frame ? ' active' : ''}" data-i="${i}" style="background:${f.bg}" aria-label="${f.label}" title="${f.label}"></button>
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

  function openViewer(record){
    currentRecord = record;
    viewerPolaroid.innerHTML = `
      <div class="shot" style="aspect-ratio: ${record.film.aspect};"><img src="${record.finalUrl}"></div>
      <div class="caption" contenteditable="true" spellcheck="false" style="opacity:1;">${record.caption}</div>
    `;
    applyFrameToViewer(record);
    renderFrameSwatches(record);

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

    const img = await loadImage(record.finalUrl);
    ctx.drawImage(img, sidePad, topPad, photoW, photoH);

    drawCaption(ctx, record, outW / 2, topPad + photoH + bottomPad * 0.55, outW - sidePad * 2);

    return new Promise((resolve)=> canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }

  function drawCaption(ctx, record, x, y, maxWidth){
    ctx.fillStyle = record.frame.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = Math.round(maxWidth * 0.042);
    const text = record.caption || '';
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    while(ctx.measureText(text).width > maxWidth && fontSize > 10){
      fontSize -= 1;
      ctx.font = `${fontSize}px 'Courier New', monospace`;
    }
    ctx.fillText(text, x, y);
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
    const img = await loadImage(record.rawUrl);

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
      ctx.filter = filterString(params);
      ctx.drawImage(img, cardX + sidePad, cardY + topPad, photoW, photoH);
      ctx.restore();

      drawCaption(ctx, record, cardX + cardW / 2, cardY + topPad + photoH + bottomPad * 0.55, cardW - sidePad * 2);
    }

    drawFrame(0);
    const stream = canvas.captureStream(24);
    const mimeType = (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e)=>{ if(e.data.size) chunks.push(e.data); };

    const duration = 5000, holdBlank = 400;
    const startTime = performance.now();

    return new Promise((resolve)=>{
      recorder.onstop = async ()=>{
        const blob = new Blob(chunks, { type: 'video/webm' });
        await shareOrDownload(blob, filenameFor(record, 'webm'), 'video/webm');
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
