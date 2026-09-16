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
    status:'Load a reference, then align the skeleton.',busy:false,history:[],panelPos:null
  };

  const root=document.createElement('div');root.id='mph-root';root.innerHTML=`
  <section id="mph-panel">
    <header class="mph-bar">
      <div><div class="mph-title">Magic Poser Helper <span class="mph-v">v4</span></div><div id="mph-sub" class="mph-sub">Visual control driver</div></div>
      <div class="mph-head"><button id="mph-collapse">–</button><button id="mph-close">×</button></div>
    </header>
    <div id="mph-body" class="mph-body">
      <div class="mph-tabs"><button data-mode="paste" class="active">Paste</button><button data-mode="upload">Upload</button><button data-mode="sketch">Sketch</button></div>

      <div id="mph-stage" class="mph-stage">
        <img id="mph-img" alt="" hidden/>
        <div id="mph-empty" class="mph-empty"><strong>Drop or paste a pose</strong><span>Then drag the skeleton dots to match.</span></div>
        <svg id="mph-skel" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>
      </div>
      <input id="mph-file" type="file" accept="image/*" hidden/>
      <div id="mph-hint" class="mph-hint">Tip: the skeleton is your correction layer — rough placement is enough.</div>

      <div class="mph-rowline"><span>Match</span><div class="mph-seg"><button data-strength="loose">Loose</button><button data-strength="close" class="active">Close</button><button data-strength="strict">Strict</button></div></div>
      <div class="mph-rowline"><span>Apply</span><div class="mph-seg"><button data-scope="whole" class="active">Whole</button><button data-scope="upper">Upper</button><button data-scope="lower">Lower</button></div></div>

      <div class="mph-quick"><button id="mph-feet">Keep Feet</button><button id="mph-mirror">Mirror</button><button id="mph-undo">Undo</button></div>
      <button id="mph-match" class="mph-primary">Match Pose</button>

      <div class="mph-command"><input id="mph-command" placeholder="Fix with words… e.g. raise left arm"/><button id="mph-command-go">Apply</button></div>

      <details id="mph-advanced"><summary>Advanced</summary>
        <div class="mph-advanced-inner">
          <button id="mph-setup" class="mph-soft">Setup / Remap Magic Poser Controls</button>
          <button id="mph-clear-map" class="mph-soft">Clear Saved Mapping</button>
          <div id="mph-map-info" class="mph-mini"></div>
        </div>
      </details>
      <div id="mph-status" class="mph-status"></div>
    </div>
  </section>`;
  document.documentElement.appendChild(root);

  const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
  const panel=$('#mph-panel'),stage=$('#mph-stage'),svg=$('#mph-skel'),img=$('#mph-img'),empty=$('#mph-empty'),file=$('#mph-file');
  let dragName=null;

  init();

  async function init(){
    const saved=await chrome.storage.local.get(['mphRigV4','mphPanelPosV4']);
    state.rig=saved.mphRigV4||{};state.panelPos=saved.mphPanelPosV4||null;
    if(state.panelPos){panel.style.left=`${state.panelPos.x}px`;panel.style.top=`${state.panelPos.y}px`;panel.style.right='auto';}
    wire();drawSkeleton();render();
  }

  function wire(){
    $('#mph-close').onclick=()=>{state.visible=false;render();};
    $('#mph-collapse').onclick=()=>{state.collapsed=!state.collapsed;render();};
    $$('.mph-tabs button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(state.mode==='upload')file.click();if(state.mode==='sketch'){state.reference=null;}render();});
    $$('.mph-seg [data-strength]').forEach(b=>b.onclick=()=>{state.strength=b.dataset.strength;render();});
    $$('.mph-seg [data-scope]').forEach(b=>b.onclick=()=>{state.scope=b.dataset.scope;render();});
    $('#mph-feet').onclick=()=>{state.keepFeet=!state.keepFeet;render();};
    $('#mph-mirror').onclick=()=>{state.skeleton=Engine.mirror(state.skeleton);drawSkeleton();};
    $('#mph-undo').onclick=undo;
    $('#mph-match').onclick=matchPose;
    $('#mph-command-go').onclick=applyCommand;
    $('#mph-command').addEventListener('keydown',e=>{if(e.key==='Enter')applyCommand();});
    $('#mph-setup').onclick=startMapping;
    $('#mph-clear-map').onclick=async()=>{state.rig={};await chrome.storage.local.remove('mphRigV4');state.status='Saved mapping cleared.';render();};
    file.onchange=async e=>{const f=e.target.files?.[0];if(f)await loadImageFile(f);};
    stage.addEventListener('dblclick',()=>{if(state.mode==='upload')file.click();});
    stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('drop');});
    stage.addEventListener('dragleave',()=>stage.classList.remove('drop'));
    stage.addEventListener('drop',async e=>{e.preventDefault();stage.classList.remove('drop');const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('image/'));if(f)await loadImageFile(f);});
    window.addEventListener('paste',async e=>{if(!state.visible)return;const it=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(it){await loadImageFile(it.getAsFile());state.mode='paste';render();}});
    chrome.runtime.onMessage.addListener(m=>{if(m.type==='MPH_TOGGLE_PANEL'){state.visible=!state.visible;render();}});
    wireSkeletonDrag();wirePanelDrag();wireMappingCapture();
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
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.dataset.name=name;c.setAttribute('cx',p.x*1000);c.setAttribute('cy',p.y*1000);c.setAttribute('r',name==='pelvis'||name==='chest'?18:14);svg.appendChild(c);
    }
  }

  function wireSkeletonDrag(){
    svg.addEventListener('pointerdown',e=>{const n=e.target?.dataset?.name;if(!n)return;dragName=n;svg.setPointerCapture?.(e.pointerId);e.preventDefault();});
    svg.addEventListener('pointermove',e=>{if(!dragName)return;const r=svg.getBoundingClientRect();state.skeleton[dragName]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};drawSkeleton();});
    const end=()=>dragName=null;svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  }

  function wirePanelDrag(){
    const bar=$('.mph-bar');let moving=false,ox=0,oy=0;
    bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=panel.getBoundingClientRect();moving=true;ox=e.clientX-r.left;oy=e.clientY-r.top;bar.setPointerCapture?.(e.pointerId);});
    bar.addEventListener('pointermove',e=>{if(!moving)return;const x=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,e.clientX-ox));const y=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,e.clientY-oy));panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';state.panelPos={x,y};});
    bar.addEventListener('pointerup',async()=>{if(moving){moving=false;await chrome.storage.local.set({mphPanelPosV4:state.panelPos});}});
  }

  function wireMappingCapture(){
    document.addEventListener('pointerdown',async e=>{
      if(!state.mapping)return;
      const canvas=Driver.getCanvas();if(!canvas||e.target!==canvas)return;
      e.preventDefault();e.stopImmediatePropagation();
      const r=canvas.getBoundingClientRect(),step=SETUP[state.mapIndex];
      state.rig[step[0]]={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
      state.mapIndex++;
      if(state.mapIndex>=SETUP.length){state.mapping=false;await chrome.storage.local.set({mphRigV4:state.rig});state.status='Control map saved. You are ready to Match Pose.';}
      else state.status=`Setup ${state.mapIndex+1}/${SETUP.length}: click ${SETUP[state.mapIndex][1]}.`;
      render();
    },true);
  }

  async function startMapping(){
    const canvas=Driver.getCanvas();if(!canvas){state.status='Magic Poser canvas not found.';render();return;}
    state.rig={};state.mapping=true;state.mapIndex=0;state.status=`Setup 1/${SETUP.length}: click ${SETUP[0][1]}.`;render();
    $('#mph-advanced').open=false;
  }

  async function matchPose(){
    if(state.busy)return;
    if(Object.keys(state.rig).length<SETUP.length){state.status='First use: Advanced → Setup / Remap controls.';$('#mph-advanced').open=true;render();return;}
    const canvas=Driver.getCanvas();if(!canvas){state.status='Magic Poser canvas not found.';render();return;}
    const target=Engine.targetCanvasPoints(state.skeleton,state.rig,canvas.getBoundingClientRect(),state.strength);
    state.busy=true;render();
    try{
      const res=await Driver.apply(state.rig,target,{scope:state.scope,keepFeet:state.keepFeet,strength:state.strength,onProgress:(i,n,name)=>{state.status=`Matching ${i}/${n}: ${pretty(name)}…`;render();}});
      state.history.push(res.before);if(state.history.length>12)state.history.shift();
      await chrome.storage.local.set({mphRigV4:state.rig});state.status=`Matched ${res.count} controls. Use words for quick fixes.`;
    }catch(err){state.status=err.message||'Match failed.';}finally{state.busy=false;render();}
  }

  async function undo(){
    if(state.busy||!state.history.length)return;
    const prev=state.history.pop(),current=JSON.parse(JSON.stringify(state.rig));state.busy=true;render();
    try{await Driver.restore(current,prev,{onProgress:(i,n)=>{state.status=`Undo ${i}/${n}…`;render();}});state.rig=prev;await chrome.storage.local.set({mphRigV4:state.rig});state.status='Undone.';}catch(e){state.status=e.message;}finally{state.busy=false;render();}
  }

  function applyCommand(){
    const input=$('#mph-command'),text=input.value.trim();if(!text)return;
    const r=Engine.parseCommand(state.skeleton,text);state.skeleton=r.skeleton;drawSkeleton();input.value='';state.status=r.changed.length?`Adjusted ${r.changed.map(pretty).join(', ')}. Press Match Pose.`:'I did not understand that one yet.';render();
  }

  function pretty(s){return s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());}

  function render(){
    panel.hidden=!state.visible;$('#mph-body').hidden=state.collapsed;$('#mph-collapse').textContent=state.collapsed?'+':'–';
    $$('.mph-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
    $$('.mph-seg [data-strength]').forEach(b=>b.classList.toggle('active',b.dataset.strength===state.strength));
    $$('.mph-seg [data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===state.scope));
    $('#mph-feet').classList.toggle('active',state.keepFeet);$('#mph-match').disabled=state.busy;$('#mph-match').textContent=state.busy?'Matching…':'Match Pose';
    $('#mph-status').textContent=state.status;$('#mph-map-info').textContent=Object.keys(state.rig).length===SETUP.length?'✓ Control map saved':'No control map yet';
    if(state.mode==='sketch'){img.hidden=true;empty.hidden=true;stage.classList.add('sketch');}else{stage.classList.remove('sketch');img.hidden=!state.reference;empty.hidden=!!state.reference;}
    $('#mph-sub').textContent=state.mapping?'Click the requested Magic Poser control':Object.keys(state.rig).length===SETUP.length?'Ready · visual control map saved':'Visual control driver';
  }
})();
