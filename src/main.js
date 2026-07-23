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
  const viewer = document.getElementById('viewer');
  const viewerPolaroid = document.getElementById('viewerPolaroid');

  let flashOn = false;
  let facingMode = 'user';
  let demoMode = false;
  let stream = null;

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
    if(e.target.closest('#deck') || e.target === shutter) return;
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
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  let photoCount = 0;

  shutter.addEventListener('click', ()=>{
    haptic(20);
    if(flashOn){ flashOverlay.classList.remove('fire'); void flashOverlay.offsetWidth; flashOverlay.classList.add('fire'); }

    const dataUrl = captureFrame();
    ejectPolaroid(dataUrl);
  });

  function ejectPolaroid(dataUrl){
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
        <img src="${dataUrl}" style="filter: brightness(0.06) saturate(0) contrast(1.2) sepia(0.3) hue-rotate(150deg);">
        <div class="develop-grain" style="opacity:0.95;"></div>
      </div>
      <div class="caption">#${String(photoCount).padStart(3,'0')} · ${new Date().toLocaleDateString()}</div>
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
      // phase 3: color blooms in slowly, like real dye coupling
      img.style.transition = 'filter 13s cubic-bezier(.16,.5,.3,1)';
      img.style.filter = 'brightness(1) saturate(1) contrast(1) sepia(0) hue-rotate(0deg)';
      grain.style.transition = 'opacity 6s ease-out';
      grain.style.opacity = '0';
    }, 2200 + 9000);

    setTimeout(()=>{
      caption.style.transition = 'opacity 2s ease';
      caption.style.opacity = '0.8';
      haptic([10,40,10]);
    }, 2200 + 9000 + 13000);

    enableDrag(pol, dataUrl);
  }

  function enableDrag(pol, dataUrl){
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
        sendToTray(pol, dataUrl);
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

  function sendToTray(pol, dataUrl){
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
      addThumb(dataUrl);
    }, 520);
  }

  function addThumb(dataUrl){
    const t = document.createElement('div');
    t.className = 'tray-thumb';
    const rot = (Math.random()*8-4).toFixed(1);
    t.style.transform = `rotate(${rot}deg)`;
    t.innerHTML = `<div class="shot"><img src="${dataUrl}"></div>`;
    t.addEventListener('click', ()=> openViewer(dataUrl));
    tray.appendChild(t);
    tray.scrollLeft = tray.scrollWidth;

    // file it away in the print box automatically, with a little "settling in" delay
    setTimeout(()=>{
      flashDrawerTab();
      addToDrawer(dataUrl);
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

  function addToDrawer(dataUrl){
    storedPrints.push(dataUrl);
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = `<div class="shot"><img src="${dataUrl}"></div>`;
    item.addEventListener('click', ()=> openViewer(dataUrl));
    drawerGrid.appendChild(item);
    refreshDrawer();
  }

  // dragging a tray thumbnail up (past the tab / into the drawer) files it away
  // dragging a tray thumbnail is no longer required to file it — kept simple, tap just views it


  function openViewer(dataUrl){
    viewerPolaroid.innerHTML = `
      <div class="shot"><img src="${dataUrl}"></div>
      <div class="caption" style="opacity:0.8;">developed</div>
    `;
    viewer.style.display = 'flex';
  }
  viewer.addEventListener('click', ()=> viewer.style.display = 'none');

})();
