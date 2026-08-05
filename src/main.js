import './style.css';

(function(){
  const video = document.getElementById('video');
  const demoBg = document.getElementById('demoBg');
  const permMsg = document.getElementById('permMsg');
  const viewfinder = document.getElementById('viewfinder');
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
  const viewer = document.getElementById('viewer');
  const viewerPolaroid = document.getElementById('viewerPolaroid');
  const saveBtn = document.getElementById('saveBtn');

  let flashOn = false;
  let facingMode = 'user';
  let demoMode = false;
  let stream = null;

  // each stock is what's "loaded" when a shot is taken — the resting look
  // it develops into, plus the flavor text a real film box would carry
  const FILM_STOCKS = [
    { label: 'Classic 600', fstop: '2.8', shutter: '125', final: 'brightness(1) saturate(1.05) contrast(1.03) sepia(0.05)' },
    { label: 'Mono 800', fstop: '4', shutter: '250', final: 'grayscale(1) contrast(1.18) brightness(1.03)' },
    { label: 'Vivid 100', fstop: '2', shutter: '60', final: 'saturate(1.45) contrast(1.15) brightness(1.02)' },
    { label: 'Faded 200', fstop: '5.6', shutter: '90', final: 'brightness(1.12) saturate(0.55) contrast(0.88) sepia(0.12)' },
    { label: 'Noir 320', fstop: '3.5', shutter: '100', final: 'sepia(0.7) contrast(1.1) saturate(0.8) brightness(0.95)' },
  ];
  let filmIndex = 0;

  function renderFilmHud(){
    const film = FILM_STOCKS[filmIndex];
    filmHud.innerHTML = `${film.label}<br>f/${film.fstop} · 1/${film.shutter}`;
  }
  renderFilmHud();

  filmHud.addEventListener('click', (e)=>{
    e.stopPropagation();
    filmIndex = (filmIndex + 1) % FILM_STOCKS.length;
    renderFilmHud();
    haptic(12);
    filmHud.classList.remove('pulse');
    void filmHud.offsetWidth;
    filmHud.classList.add('pulse');
    setTimeout(()=> filmHud.classList.remove('pulse'), 500);
  });

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

  function captureFrame(){
    const canvas = document.createElement('canvas');
    const w = 480, h = 640;
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
    if(flashOn){ flashOverlay.classList.remove('fire'); void flashOverlay.offsetWidth; flashOverlay.classList.add('fire'); }

    const film = FILM_STOCKS[filmIndex];
    const canvas = captureFrame();
    const rawUrl = canvas.toDataURL('image/jpeg', 0.9);
    const finalUrl = renderFilmVariant(canvas, film.final);
    ejectPolaroid(rawUrl, finalUrl, film);
  });

  function ejectPolaroid(rawUrl, finalUrl, film){
    photoCount++;
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
    pol.style.zIndex = 20 + photoCount;

    pol.innerHTML = `
      <div class="shot">
        <img src="${rawUrl}" style="filter: brightness(0.06) saturate(0) contrast(1.2) sepia(0.3) hue-rotate(150deg);">
        <div class="develop-grain" style="opacity:0.95;"></div>
      </div>
      <div class="caption">#${String(photoCount).padStart(3,'0')} · ${new Date().toLocaleDateString()} · ${film.label}</div>
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
    // phase 1: nothing visible yet, chemicals spreading under the surface
    // phase 2: a dark, cool, ghostly image swims up out of black
    // phase 3: color and contrast slowly bloom in as the dyes finish coupling
    const img = pol.querySelector('img');
    const grain = pol.querySelector('.develop-grain');
    const caption = pol.querySelector('.caption');
    const dragHint = pol.querySelector('.drag-hint');

    setTimeout(()=>{ dragHint.style.opacity = '0.7'; }, 1000);
    setTimeout(()=>{ dragHint.style.opacity = '0'; }, 4000);

    setTimeout(()=>{
      // phase 2 starts
      img.style.transition = 'filter 9s cubic-bezier(.33,.1,.4,1)';
      img.style.filter = 'brightness(0.55) saturate(0.15) contrast(1.35) sepia(0.15) hue-rotate(60deg)';
      grain.style.transition = 'opacity 9s ease-out';
      grain.style.opacity = '0.5';
      haptic(8);
    }, 2200);

    setTimeout(()=>{
      // phase 3: color blooms in slowly, like real dye coupling — settling
      // into whatever stock was loaded when the shot was taken
      img.style.transition = 'filter 13s cubic-bezier(.16,.5,.3,1)';
      img.style.filter = film.final;
      grain.style.transition = 'opacity 6s ease-out';
      grain.style.opacity = '0';
    }, 2200 + 9000);

    setTimeout(()=>{
      caption.style.transition = 'opacity 2s ease';
      caption.style.opacity = '0.8';
      haptic([10,40,10]);
    }, 2200 + 9000 + 13000);

    enableDrag(pol, finalUrl, film);
  }

  function enableDrag(pol, finalUrl, film){
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
        sendToTray(pol, finalUrl, film);
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

  function sendToTray(pol, finalUrl, film){
    if(!pol.parentElement) return;
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
      addThumb(finalUrl, film);
    }, 520);
  }

  function addThumb(dataUrl, film){
    const t = document.createElement('div');
    t.className = 'tray-thumb';
    const rot = (Math.random()*8-4).toFixed(1);
    t.style.transform = `rotate(${rot}deg)`;
    t.innerHTML = `<div class="shot"><img src="${dataUrl}"></div>`;
    t.addEventListener('click', ()=> openViewer(dataUrl, film));
    tray.appendChild(t);
    tray.scrollLeft = tray.scrollWidth;

    // file it away in the print box automatically, with a little "settling in" delay
    setTimeout(()=>{
      flashDrawerTab();
      addToDrawer(dataUrl, film);
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

  function addToDrawer(dataUrl, film){
    storedPrints.push(dataUrl);
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = `<div class="shot"><img src="${dataUrl}"></div>`;
    item.addEventListener('click', ()=> openViewer(dataUrl, film));
    drawerGrid.appendChild(item);
    refreshDrawer();
  }

  // dragging a tray thumbnail up (past the tab / into the drawer) files it away
  // dragging a tray thumbnail is no longer required to file it — kept simple, tap just views it

  let viewerDataUrl = '';
  let viewerFilename = 'polaroid-cam.jpg';

  function openViewer(dataUrl, film){
    viewerDataUrl = dataUrl;
    const slug = (film ? film.label : 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    viewerFilename = `polaroid-${slug}-${Date.now()}.jpg`;
    viewerPolaroid.innerHTML = `
      <div class="shot"><img src="${dataUrl}"></div>
      <div class="caption" style="opacity:0.8;">${film ? film.label : 'developed'}</div>
    `;
    viewer.style.display = 'flex';
  }
  viewer.addEventListener('click', ()=> viewer.style.display = 'none');

  saveBtn.addEventListener('click', async (e)=>{
    e.stopPropagation();
    haptic([10,30,10]);

    if(navigator.canShare){
      try{
        const res = await fetch(viewerDataUrl);
        const blob = await res.blob();
        const file = new File([blob], viewerFilename, { type: blob.type || 'image/jpeg' });
        if(navigator.canShare({ files: [file] })){
          await navigator.share({ files: [file], title: 'Polaroid Cam' });
          return;
        }
      }catch(err){
        if(err && err.name === 'AbortError') return; // user dismissed the share sheet
        // otherwise fall through to a direct download below
      }
    }

    const a = document.createElement('a');
    a.href = viewerDataUrl;
    a.download = viewerFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

})();
