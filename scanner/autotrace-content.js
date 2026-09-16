(() => {
  const SOURCE = 'mph-auto-trace-page';
  const manualEdits = new Set();
  const confidence = new Map();
  let scannerBooted = false;
  let scanBusy = false;
  let requestId = 0;
  let lastImageSrc = '';

  bootWhenReady();

  function bootWhenReady() {
    const root = document.querySelector('#mph-root');
    const stage = root?.querySelector('#mph-stage');
    const image = root?.querySelector('#mph-img');
    const svg = root?.querySelector('#mph-skel');
    const hint = root?.querySelector('#mph-hint');
    if (!root || !stage || !image || !svg || !hint) {
      setTimeout(bootWhenReady, 120);
      return;
    }

    root.querySelector('.mph-v')?.replaceChildren(document.createTextNode('v6'));
    buildUI(root, hint);
    injectScannerModule();
    wireScannerMessages(root, stage, image, svg);
    wireReferenceWatcher(root, image);
    wireManualEditTracking(svg);
    wireSkeletonConfidenceWatcher(svg);
  }

  function buildUI(root, hint) {
    if (root.querySelector('#mph-auto-trace')) return;
    const row = document.createElement('div');
    row.className = 'mph-autotrace-row';
    hint.parentNode.insertBefore(row, hint);
    row.appendChild(hint);
    hint.textContent = 'Tip: Auto Trace gets you close; drag any bad joint after.';

    const button = document.createElement('button');
    button.id = 'mph-auto-trace';
    button.className = 'mph-autotrace-btn';
    button.textContent = 'Auto Trace';
    row.appendChild(button);

    const status = document.createElement('div');
    status.id = 'mph-autotrace-status';
    status.className = 'mph-autotrace-status';
    row.insertAdjacentElement('afterend', status);

    button.addEventListener('click', () => scanReference(root));
  }

  function injectScannerModule() {
    if (document.getElementById('mph-pose-scanner-module')) return;
    const script = document.createElement('script');
    script.id = 'mph-pose-scanner-module';
    script.type = 'module';
    script.src = chrome.runtime.getURL('scanner/pose-scanner.mjs');
    (document.head || document.documentElement).appendChild(script);
  }

  function wireScannerMessages(root, stage, image, svg) {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const message = event.data;
      if (!message || message.source !== SOURCE) return;
      if (message.type === 'MPH_SCANNER_BOOTED') { scannerBooted = true; return; }
      if (message.requestId !== requestId) return;
      if (message.type === 'MPH_SCAN_RESULT') applyLandmarks(root, stage, image, svg, message.landmarks);
      else if (message.type === 'MPH_SCAN_ERROR') { scanBusy = false; updateScanUI(root, `Couldn't read this pose: ${message.message || 'unknown error'}`, false); }
    });
  }

  function wireReferenceWatcher(root, image) {
    const markReferenceReady = () => {
      const src = image.getAttribute('src') || '';
      if (!src || src === lastImageSrc || !src.startsWith('data:image/')) return;
      lastImageSrc = src;
      manualEdits.clear(); confidence.clear();
      root.querySelectorAll('#mph-skel circle').forEach(circle => { circle.classList.remove('mph-scan-uncertain'); circle.removeAttribute('title'); });
      updateScanUI(root, 'Reference ready · click Auto Trace when you want the stickman fitted.', false);
    };
    const observer = new MutationObserver(markReferenceReady);
    observer.observe(image, { attributes: true, attributeFilter: ['src'] });
    if (image.src?.startsWith('data:image/')) { lastImageSrc = ''; markReferenceReady(); }
  }

  function wireManualEditTracking(svg) {
    svg.addEventListener('pointerdown', (event) => {
      const name = event.target?.dataset?.name;
      if (!name) return;
      manualEdits.add(name); confidence.delete(name);
      requestAnimationFrame(() => applyConfidenceClasses(svg));
    }, true);
  }

  function wireSkeletonConfidenceWatcher(svg) {
    const observer = new MutationObserver(() => requestAnimationFrame(() => applyConfidenceClasses(svg)));
    observer.observe(svg, { childList: true });
  }

  async function scanReference(root) {
    if (scanBusy) return;
    const image = root.querySelector('#mph-img');
    if (!image || image.hidden || !image.src?.startsWith('data:image/')) return;
    scanBusy = true; requestId += 1;
    const thisRequest = requestId;
    updateScanUI(root, 'Scanning pose…', true);
    for (let i = 0; i < 20 && !scannerBooted; i++) await sleep(100);
    window.postMessage({ source: 'mph-auto-trace-extension', type: 'MPH_SCAN_REFERENCE', requestId: thisRequest, dataUrl: image.src }, '*');
    setTimeout(() => {
      if (!scanBusy || requestId !== thisRequest) return;
      scanBusy = false;
      updateScanUI(root, 'Scanner timed out. You can still trace manually or try again.', false);
    }, 30000);
  }

  function applyLandmarks(root, stage, image, svg, landmarks) {
    scanBusy = false;
    if (!Array.isArray(landmarks) || landmarks.length < 29) { updateScanUI(root, 'No complete body pose was found.', false); return; }
    const point = (index) => landmarks[index] || {};
    const average = (...indices) => {
      const points = indices.map(point).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (!points.length) return null;
      return { x: points.reduce((sum,p)=>sum+p.x,0)/points.length, y: points.reduce((sum,p)=>sum+p.y,0)/points.length, confidence: points.reduce((sum,p)=>sum+landmarkConfidence(p),0)/points.length };
    };
    const detected = {
      head: average(7,8) || average(0), chest: average(11,12), pelvis: average(23,24),
      leftShoulder: average(11), leftElbow: average(13), leftWrist: average(15),
      rightShoulder: average(12), rightElbow: average(14), rightWrist: average(16),
      leftKnee: average(25), leftAnkle: average(27), rightKnee: average(26), rightAnkle: average(28)
    };
    confidence.clear(); let strong=0, weak=0;
    for (const [name,p] of Object.entries(detected)) {
      if (!p) continue;
      confidence.set(name,p.confidence); if (p.confidence >= .55) strong++; else weak++;
      if (manualEdits.has(name) && p.confidence < .55) continue;
      moveOverlayJoint(svg,name,imagePointToStage(stage,image,p.x,p.y));
    }
    requestAnimationFrame(()=>applyConfidenceClasses(svg));
    updateScanUI(root, weak ? `${strong} joints confident · ${weak} yellow joints need a quick check` : `${strong} joints detected · looks clean`, false);
  }

  function moveOverlayJoint(svg,name,normalized) {
    const circle=svg.querySelector(`circle[data-name="${name}"]`); if(!circle)return;
    const rect=svg.getBoundingClientRect(), current=circle.getBoundingClientRect(), pointerId=900+Math.floor(Math.random()*10000);
    const common={bubbles:true,cancelable:true,pointerId,pointerType:'mouse',isPrimary:true,button:0};
    circle.dispatchEvent(new PointerEvent('pointerdown',{...common,buttons:1,clientX:current.left+current.width/2,clientY:current.top+current.height/2}));
    svg.dispatchEvent(new PointerEvent('pointermove',{...common,buttons:1,clientX:rect.left+normalized.x*rect.width,clientY:rect.top+normalized.y*rect.height}));
    svg.dispatchEvent(new PointerEvent('pointerup',{...common,buttons:0,clientX:rect.left+normalized.x*rect.width,clientY:rect.top+normalized.y*rect.height}));
  }

  function imagePointToStage(stage,image,x,y) {
    const sw=stage.clientWidth||1, sh=stage.clientHeight||1, iw=image.naturalWidth||sw, ih=image.naturalHeight||sh;
    const scale=Math.min(sw/iw,sh/ih), drawWidth=iw*scale, drawHeight=ih*scale, offsetX=(sw-drawWidth)/2, offsetY=(sh-drawHeight)/2;
    return {x:clamp((offsetX+x*drawWidth)/sw,0,1),y:clamp((offsetY+y*drawHeight)/sh,0,1)};
  }

  function applyConfidenceClasses(svg) {
    for (const circle of svg.querySelectorAll('circle[data-name]')) {
      const value=confidence.get(circle.dataset.name);
      circle.classList.toggle('mph-scan-uncertain',Number.isFinite(value)&&value<.55);
      if(Number.isFinite(value)) circle.title=value<.55?`${pretty(circle.dataset.name)} · check this joint`:`${pretty(circle.dataset.name)} · detected`;
    }
  }

  function updateScanUI(root,message,busy) {
    const button=root.querySelector('#mph-auto-trace'), status=root.querySelector('#mph-autotrace-status');
    if(button){button.disabled=busy;button.textContent=busy?'Scanning…':'Auto Trace';}
    if(status)status.textContent=message;
  }

  function landmarkConfidence(p){if(Number.isFinite(p.visibility))return p.visibility;if(Number.isFinite(p.presence))return p.presence;return .7;}
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const pretty=value=>value.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
})();