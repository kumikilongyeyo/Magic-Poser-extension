(() => {
  const Engine=window.MPHPoseEngine, Driver=window.MPHVisualDriver;
  const SETUP=[
    ['pelvis','PELVIS square / center'],['chest','CHEST square'],['head','HEAD square'],
    ['leftShoulder','LEFT SHOULDER dot'],['leftElbow','LEFT ELBOW dot'],['leftWrist','LEFT WRIST dot'],
    ['rightShoulder','RIGHT SHOULDER dot'],['rightElbow','RIGHT ELBOW dot'],['rightWrist','RIGHT WRIST dot'],
    ['leftKnee','LEFT KNEE dot'],['leftAnkle','LEFT ANKLE dot'],['rightKnee','RIGHT KNEE dot'],['rightAnkle','RIGHT ANKLE dot']
  ];
  const LINKS=[
    ['head','chest'],['chest','pelvis'],
    ['chest','leftShoulder'],['leftShoulder','leftElbow'],['leftElbow','leftWrist'],
    ['chest','rightShoulder'],['rightShoulder','rightElbow'],['rightElbow','rightWrist'],
    ['pelvis','leftKnee'],['leftKnee','leftAnkle'],['pelvis','rightKnee'],['rightKnee','rightAnkle']
  ];

  const state={
    visible:true,collapsed:false,mode:'paste',reference:null,skeleton:Engine.defaultSkeleton(),
    strength:'close',scope:'whole',keepFeet:false,rig:{},mapping:false,mapIndex:0,
    status:'Load a reference, then align the skeleton.',busy:false,history:[],redoHistory:[],panelPos:null,panelSize:null,expanded:false,selectedJoint:null,preMapCollapsed:false
  };

  const root=document.createElement('div');root.id='mph-root';root.innerHTML=`
  <section id="mph-panel">
    <header class="mph-bar">
      <div><div class="mph-title">Magic Poser Helper <span class="mph-v">v5.2</span></div><div id="mph-sub" class="mph-sub">Visual control driver</div></div>
      <div class="mph-head"><button id="mph-expand" title="Expand tracing">⛶</button><button id="mph-collapse">–</button><button id="mph-close">×</button></div>
    </header>
    <div id="mph-body" class="mph-body">
      <div class="mph-tabs"><button data-mode="paste" class="active">Paste</button><button data-mode="upload">Upload</button><button data-mode="sketch">Sketch</button></div>

      <div id="mph-stage" class="mph-stage">
        <img id="mph-img" alt="" hidden/>
        <div id="mph-empty" class="mph-empty"><strong>Drop or paste a pose</strong><span>Then drag the skeleton dots to match.</span></div>
        <svg id="mph-skel" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>
        <div id="mph-joint-label" class="mph-joint-label" hidden></div>
        <div id="mph-stage-resize" class="mph-stage-resize" title="Drag to resize reference"></div>
      </div>
      <input id="mph-file" type="file" accept="image/*" hidden/>
      <div id="mph-hint" class="mph-hint">Tip: the skeleton is your correction layer — rough placement is enough.</div>

      <div class="mph-rowline"><span>Match</span><div class="mph-seg"><button data-strength="loose">Loose</button><button data-strength="close" class="active">Close</button><button data-strength="strict">Strict</button></div></div>
      <div class="mph-rowline"><span>Apply</span><div class="mph-seg"><button data-scope="whole" class="active">Whole</button><button data-scope="upper">Upper</button><button data-scope="lower">Lower</button></div></div>

      <div id="mph-map-card" class="mph-map-card">
        <div class="mph-map-copy">
          <strong>3D Model Controls</strong>
          <span id="mph-map-state">Required before Match Pose</span>
        </div>
        <button id="mph-setup-main" class="mph-map-button">Map Controls</button>
      </div>
      <div class="mph-map-note">Remap only if you move/zoom the Magic Poser camera or change the model framing.</div>

      <div class="mph-quick mph-quick-4"><button id="mph-feet">Keep Feet</button><button id="mph-mirror">Mirror</button><button id="mph-undo">Undo</button><button id="mph-redo">Redo</button></div>
      <button id="mph-match" class="mph-primary">Match Pose</button>

      <details id="mph-advanced"><summary>Advanced</summary>
        <div class="mph-advanced-inner">
          <button id="mph-clear-map" class="mph-soft">Clear Saved Mapping</button>
          <div id="mph-map-info" class="mph-mini"></div>
        </div>
      </details>
      <div id="mph-status" class="mph-status"></div>
      <div id="mph-map-overlay" class="mph-map-overlay" hidden>
        <div class="mph-map-overlay-step" id="mph-map-overlay-step">1 / 13</div>
        <strong id="mph-map-overlay-target">Click Pelvis</strong>
        <span>Click the requested black control directly on the 3D mannequin. Esc cancels.</span>
      </div>
    </div>
  </section>`;
  document.documentElement.appendChild(root);

  const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
  const panel=$('#mph-panel'),stage=$('#mph-stage'),svg=$('#mph-skel'),img=$('#mph-img'),empty=$('#mph-empty'),file=$('#mph-file');
  let dragName=null;

  init();

  async function init(){
    const saved=await chrome.storage.local.get(['mphRigV4','mphPanelPosV4','mphPanelSizeV4']);
    state.rig=saved.mphRigV4||{};state.panelPos=saved.mphPanelPosV4||null;state.panelSize=saved.mphPanelSizeV4||null;
    if(state.panelPos){panel.style.left=`${state.panelPos.x}px`;panel.style.top=`${state.panelPos.y}px`;panel.style.right='auto';}
    wire();drawSkeleton();render();
  }

  function wire(){
    $('#mph-close').onclick=()=>{state.visible=false;render();};
    $('#mph-expand').onclick=toggleExpanded;
    $('#mph-collapse').onclick=()=>{state.collapsed=!state.collapsed;render();};
    $$('.mph-tabs button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='upload')file.click();if(state.mode==='sketch'){state.reference=null;}render();});
    $$('.mph-seg [data-strength]').forEach(b=>b.onclick=()=>{state.strength=b.dataset.strength;render();});
    $$('.mph-seg [data-scope]').forEach(b=>b.onclick=()=>{state.scope=b.dataset.scope;render();});
    $('#mph-feet').onclick=()=>{state.keepFeet=!state.keepFeet;render();};
    $('#mph-mirror').onclick=()=>{state.skeleton=Engine.mirror(state.skeleton);drawSkeleton();};
    $('#mph-undo').onclick=undo;
    $('#mph-redo').onclick=redo;
    $('#mph-match').onclick=matchPose;
    $('#mph-setup-main').onclick=startMapping;
    $('#mph-clear-map').onclick=async()=>{state.rig={};await chrome.storage.local.remove('mphRigV4');state.status='Saved mapping cleared.';render();};
    file.onchange=async e=>{const f=e.target.files?.[0];if(f)await loadImageFile(f);};
    stage.addEventListener('dblclick',()=>{if(state.mode==='upload')file.click();});
    stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('drop');});
    stage.addEventListener('dragleave',()=>stage.classList.remove('drop'));
    stage.addEventListener('drop',async e=>{e.preventDefault();stage.classList.remove('drop');const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('image/'));if(f)await loadImageFile(f);});
    window.addEventListener('paste',async e=>{if(!state.visible)return;const it=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(it){await loadImageFile(it.getAsFile());state.mode='paste';render();}});
    chrome.runtime.onMessage.addListener(m=>{if(m.type==='MPH_TOGGLE_PANEL'){state.visible=!state.visible;render();}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.mapping)cancelMapping();});
    wireSkeletonDrag();wirePanelDrag();wireStageResize();wireMappingCapture();
  }

  async function loadImageFile(f){
    state.reference=await blobToDataURL(f);img.src=state.reference;img.hidden=false;empty.hidden=true;state.status='Reference loaded. Align the dots, then Match Pose.';render();
  }
  const blobToDataURL=b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b);});

  function drawSkeleton(){
    svg.innerHTML='';
    for(const [a,b] of LINKS){
      const A=state.skeleton[a],B=state.skeleton[b];if(!A||!B)continue;
      const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',A.x*1000);l.setAttribute('y1',A.y*1000);l.setAttribute('x2',B.x*1000);l.setAttribute('y2',B.y*1000);svg.appendChild(l);
    }
    for(const [name,p] of Object.entries(state.skeleton)){
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.dataset.name=name;c.setAttribute('cx',p.x*1000);c.setAttribute('cy',p.y*1000);c.setAttribute('r',name==='pelvis'||name==='chest'?18:14);if(name===state.selectedJoint)c.classList.add('selected');svg.appendChild(c);
    }
  }

  function wireSkeletonDrag(){
    svg.addEventListener('pointerdown',e=>{const n=e.target?.dataset?.name;if(!n)return;dragName=n;state.selectedJoint=n;drawSkeleton();render();svg.setPointerCapture?.(e.pointerId);e.preventDefault();});
    svg.addEventListener('pointermove',e=>{if(!dragName)return;const r=svg.getBoundingClientRect();state.skeleton[dragName]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};drawSkeleton();});
    const end=()=>dragName=null;svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  }

  function wirePanelDrag(){
    const bar=$('.mph-bar');let moving=false,ox=0,oy=0;
    bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=panel.getBoundingClientRect();moving=true;ox=e.clientX-r.left;oy=e.clientY-r.top;bar.setPointerCapture?.(e.pointerId);});
    bar.addEventListener('pointermove',e=>{if(!moving)return;const x=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,e.clientX-ox));const y=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,e.clientY-oy));panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';state.panelPos={x,y};});
    bar.addEventListener('pointerup',async()=>{if(moving){moving=false;await chrome.storage.local.set({mphPanelPosV4:state.panelPos});}});
  }

  function toggleExpanded(){state.expanded=!state.expanded;render();requestAnimationFrame(clampPanelIntoViewport);}
  function clampPanelIntoViewport(){const r=panel.getBoundingClientRect();let x=r.left,y=r.top;if(r.right>innerWidth-4)x=Math.max(4,innerWidth-r.width-4);if(r.bottom>innerHeight-4)y=Math.max(4,innerHeight-r.height-4);if(x<4)x=4;if(y<4)y=4;panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';state.panelPos={x,y};}

  function wireStageResize(){
    const handle=$('#mph-stage-resize');let resizing=false,sx=0,sy=0,sw=0,sh=0;
    handle.addEventListener('pointerdown',e=>{resizing=true;state.expanded=false;sx=e.clientX;sy=e.clientY;sw=panel.getBoundingClientRect().width;sh=stage.getBoundingClientRect().height;handle.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation();});
    handle.addEventListener('pointermove',e=>{if(!resizing)return;const maxW=Math.max(306,innerWidth-16),maxH=Math.max(174,innerHeight-250);const w=Math.max(306,Math.min(maxW,sw+(e.clientX-sx)));const h=Math.max(174,Math.min(maxH,sh+(e.clientY-sy)));state.panelSize={w,h};panel.style.width=w+'px';stage.style.height=h+'px';clampPanelIntoViewport();});
    handle.addEventListener('pointerup',async()=>{if(!resizing)return;resizing=false;await chrome.storage.local.set({mphPanelSizeV4:state.panelSize,mphPanelPosV4:state.panelPos});render();});
    handle.addEventListener('pointercancel',()=>resizing=false);
  }

  function flashMapPoint(x,y,label){const el=document.createElement('div');el.className='mph-map-flash';el.textContent='✓ '+label;el.style.left=x+'px';el.style.top=y+'px';root.appendChild(el);setTimeout(()=>el.remove(),850);}

  function wireMappingCapture(){
    document.addEventListener('pointerdown',async e=>{
      if(!state.mapping)return;
      const canvas=Driver.getCanvas();if(!canvas||e.target!==canvas)return;
      e.preventDefault();e.stopImmediatePropagation();
      const r=canvas.getBoundingClientRect(),step=SETUP[state.mapIndex];
      state.rig[step[0]]={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
      flashMapPoint(e.clientX,e.clientY,pretty(step[0]));
      state.mapIndex++;
      if(state.mapIndex>=SETUP.length){state.mapping=false;state.collapsed=state.preMapCollapsed;await chrome.storage.local.set({mphRigV4:state.rig});state.status='3D controls mapped ✓ Now press Match Pose.';}
      else state.status=`Mapping ${state.mapIndex+1}/${SETUP.length}: click ${SETUP[state.mapIndex][1]}.`;
      render();
    },true);
  }

  async function startMapping(){
    const canvas=Driver.getCanvas();if(!canvas){state.status='Magic Poser canvas not found.';render();return;}
    state.rig={};state.mapping=true;state.mapIndex=0;state.preMapCollapsed=state.collapsed;state.collapsed=true;state.status=`Mapping 1/${SETUP.length}: click ${SETUP[0][1]}.`;render();
  }

  function cancelMapping(){state.mapping=false;state.mapIndex=0;state.rig={};state.collapsed=state.preMapCollapsed;state.status='Mapping cancelled. Map the 3D controls before Match Pose.';render();}

  async function matchPose(){
    if(state.busy)return;
    if(Object.keys(state.rig).length<SETUP.length){state.status='Map 3D Controls first — this is required before Match Pose.';$('#mph-map-card').classList.add('attention');setTimeout(()=>$('#mph-map-card')?.classList.remove('attention'),900);render();return;}
    const canvas=Driver.getCanvas();if(!canvas){state.status='Magic Poser canvas not found.';render();return;}
    const target=Engine.targetCanvasPoints(state.skeleton,state.rig,canvas.getBoundingClientRect(),state.strength);
    state.busy=true;render();
    try{const res=await Driver.apply(state.rig,target,{scope:state.scope,keepFeet:state.keepFeet,strength:state.strength,onProgress:(i,n,name)=>{state.status=`Matching ${i}/${n}: ${pretty(name)}…`;render();}});state.history.push(res.before);if(state.history.length>12)state.history.shift();state.redoHistory=[];await chrome.storage.local.set({mphRigV4:state.rig});state.status=`Matched ${res.count} controls. Adjust the reference skeleton and press Match Pose again if needed.`;}catch(err){state.status=err.message||'Match failed.';}finally{state.busy=false;render();}
  }

  async function undo(){if(state.busy||!state.history.length)return;const prev=state.history.pop(),current=JSON.parse(JSON.stringify(state.rig));state.redoHistory.push(current);if(state.redoHistory.length>12)state.redoHistory.shift();state.busy=true;render();try{await Driver.restore(current,prev,{onProgress:(i,n)=>{state.status=`Undo ${i}/${n}…`;render();}});state.rig=prev;await chrome.storage.local.set({mphRigV4:state.rig});state.status='Undone. Redo is available.';}catch(e){state.redoHistory.pop();state.status=e.message;}finally{state.busy=false;render();}}
  async function redo(){if(state.busy||!state.redoHistory.length)return;const next=state.redoHistory.pop(),current=JSON.parse(JSON.stringify(state.rig));state.history.push(current);if(state.history.length>12)state.history.shift();state.busy=true;render();try{await Driver.restore(current,next,{onProgress:(i,n)=>{state.status=`Redo ${i}/${n}…`;render();}});state.rig=next;await chrome.storage.local.set({mphRigV4:state.rig});state.status='Redone.';}catch(e){state.history.pop();state.redoHistory.push(next);state.status=e.message;}finally{state.busy=false;render();}}
  function pretty(s){return s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());}

  function render(){
    panel.hidden=!state.visible;panel.classList.toggle('expanded',state.expanded);$('#mph-body').hidden=state.collapsed;$('#mph-collapse').textContent=state.collapsed?'+':'–';$('#mph-expand').textContent=state.expanded?'↙':'⛶';
    if(state.expanded){panel.style.width='';stage.style.height='';}else if(state.panelSize){panel.style.width=state.panelSize.w+'px';stage.style.height=state.panelSize.h+'px';}
    $$('.mph-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
    $$('.mph-seg [data-strength]').forEach(b=>b.classList.toggle('active',b.dataset.strength===state.strength));
    $$('.mph-seg [data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===state.scope));
    $('#mph-feet').classList.toggle('active',state.keepFeet);$('#mph-undo').disabled=state.busy||!state.history.length;$('#mph-redo').disabled=state.busy||!state.redoHistory.length;$('#mph-match').disabled=state.busy;$('#mph-match').textContent=state.busy?'Matching…':'Match Pose';
    const mapped=Object.keys(state.rig).length===SETUP.length;
    $('#mph-status').textContent=state.status;$('#mph-map-info').textContent=mapped?'✓ 3D control map saved':'No 3D control map yet';$('#mph-map-state').textContent=state.mapping?`Mapping ${state.mapIndex+1}/${SETUP.length}`:(mapped?'Mapped ✓':'Required before Match Pose');$('#mph-setup-main').textContent=state.mapping?'Mapping…':(mapped?'Remap':'Map Controls');$('#mph-setup-main').disabled=state.mapping||state.busy;$('#mph-map-card').classList.toggle('ready',mapped&&!state.mapping);
    const mo=$('#mph-map-overlay');mo.hidden=!state.mapping;if(state.mapping){$('#mph-map-overlay-step').textContent=`${state.mapIndex+1} / ${SETUP.length}`;$('#mph-map-overlay-target').textContent=`Click ${pretty(SETUP[state.mapIndex][0])}`;}
    const jl=$('#mph-joint-label');if(state.selectedJoint&&state.skeleton[state.selectedJoint]){const p=state.skeleton[state.selectedJoint];jl.hidden=false;jl.textContent=pretty(state.selectedJoint);jl.style.left=(p.x*100)+'%';jl.style.top=(p.y*100)+'%';}else jl.hidden=true;
    if(state.mode==='sketch'){img.hidden=true;empty.hidden=true;stage.classList.add('sketch');}else{stage.classList.remove('sketch');img.hidden=!state.reference;empty.hidden=!!state.reference;}
    $('#mph-sub').textContent=state.mapping?'Mapping 3D controls…':mapped?'Ready · 3D controls mapped':'Step 1 · Map 3D controls';
  }
})();