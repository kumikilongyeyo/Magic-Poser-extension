(() => {
  const NAMES = [
    'head','chest','pelvis',
    'leftShoulder','leftElbow','leftWrist',
    'rightShoulder','rightElbow','rightWrist',
    'leftKnee','leftAnkle','rightKnee','rightAnkle'
  ];

  const defaultSkeleton = () => ({
    head:{x:.50,y:.12}, chest:{x:.50,y:.31}, pelvis:{x:.50,y:.53},
    leftShoulder:{x:.39,y:.31}, leftElbow:{x:.27,y:.32}, leftWrist:{x:.15,y:.32},
    rightShoulder:{x:.61,y:.31}, rightElbow:{x:.73,y:.32}, rightWrist:{x:.85,y:.32},
    leftKnee:{x:.45,y:.72}, leftAnkle:{x:.44,y:.91},
    rightKnee:{x:.55,y:.72}, rightAnkle:{x:.56,y:.91}
  });

  const clone = v => JSON.parse(JSON.stringify(v));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const point = (s,n) => s[n] || {x:.5,y:.5};

  function mirror(input){
    const s=clone(input), cx=point(s,'pelvis').x;
    const pairs=[
      ['leftShoulder','rightShoulder'],['leftElbow','rightElbow'],['leftWrist','rightWrist'],
      ['leftKnee','rightKnee'],['leftAnkle','rightAnkle']
    ];
    Object.values(s).forEach(p=>p.x=cx-(p.x-cx));
    pairs.forEach(([a,b])=>{const t=s[a];s[a]=s[b];s[b]=t;});
    return s;
  }

  function move(s,n,dx,dy){ if(!s[n])return; s[n].x=clamp(s[n].x+dx,0,1);s[n].y=clamp(s[n].y+dy,0,1); }
  function groupMove(s,names,dx,dy){names.forEach(n=>move(s,n,dx,dy));}

  function parseCommand(input,text){
    let s=clone(input||defaultSkeleton());
    const t=(text||'').toLowerCase().replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim();
    const changed=new Set();
    const delta=/slightly|little|a bit/.test(t)?.025:/much|more|higher|lower|farther|further/.test(t)?.07:.045;
    const side=t.includes('left')?'left':t.includes('right')?'right':null;
    const sides=side?[side]:['left','right'];
    const touch=(name,dx,dy)=>{move(s,name,dx,dy);changed.add(name);};

    if(/mirror|flip pose|swap sides/.test(t)){s=mirror(s);NAMES.forEach(n=>changed.add(n));}
    if(/raise .*arm|arm .*higher|hand .*higher/.test(t)) sides.forEach(x=>{touch(`${x}Elbow`,0,-delta*.75);touch(`${x}Wrist`,0,-delta);});
    if(/lower .*arm|arm .*lower|hand .*lower/.test(t)) sides.forEach(x=>{touch(`${x}Elbow`,0,delta*.75);touch(`${x}Wrist`,0,delta);});
    if(/arm .*out|reach .*out|wider arms/.test(t)) sides.forEach(x=>{const d=x==='left'?-delta:delta;touch(`${x}Elbow`,d*.65,0);touch(`${x}Wrist`,d,0);});
    if(/arm .*in|hands .*closer|arms .*closer/.test(t)) sides.forEach(x=>{const d=x==='left'?delta:-delta;touch(`${x}Elbow`,d*.65,0);touch(`${x}Wrist`,d,0);});
    if(/bend .*elbow|elbow .*more/.test(t)) sides.forEach(x=>{const e=s[`${x}Elbow`],w=s[`${x}Wrist`],sh=s[`${x}Shoulder`]; if(e&&w&&sh){e.x=(w.x+sh.x)/2+(x==='left'?delta:-delta);e.y=(w.y+sh.y)/2+delta*.5;changed.add(`${x}Elbow`);}});
    if(/bend .*knee|knee .*more/.test(t)) sides.forEach(x=>{const k=s[`${x}Knee`],a=s[`${x}Ankle`],p=s.pelvis;if(k&&a&&p){k.x=(a.x+p.x)/2+(x==='left'?-delta:delta);k.y=(a.y+p.y)/2;changed.add(`${x}Knee`);}});
    if(/wider stance|spread .*legs|legs .*wider/.test(t)){touch('leftAnkle',-delta,0);touch('rightAnkle',delta,0);touch('leftKnee',-delta*.45,0);touch('rightKnee',delta*.45,0);}
    if(/narrower stance|legs .*closer|close .*stance/.test(t)){touch('leftAnkle',delta,0);touch('rightAnkle',-delta,0);touch('leftKnee',delta*.45,0);touch('rightKnee',-delta*.45,0);}
    if(/lean .*left/.test(t)){groupMove(s,['head','chest'], -delta,0);changed.add('head');changed.add('chest');}
    if(/lean .*right/.test(t)){groupMove(s,['head','chest'], delta,0);changed.add('head');changed.add('chest');}
    if(/head .*left|look left/.test(t)){touch('head',-delta,0);}
    if(/head .*right|look right/.test(t)){touch('head',delta,0);}
    if(/head .*up|look up/.test(t)){touch('head',0,-delta);}
    if(/head .*down|look down/.test(t)){touch('head',0,delta);}
    if(/more dynamic|exaggerate|stronger pose/.test(t)){
      const p=s.pelvis;Object.entries(s).forEach(([n,q])=>{if(n==='pelvis')return;q.x=clamp(p.x+(q.x-p.x)*1.08,0,1);q.y=clamp(p.y+(q.y-p.y)*1.08,0,1);changed.add(n);});
    }
    if(/more neutral|less dynamic|relax/.test(t)){
      const p=s.pelvis;Object.entries(s).forEach(([n,q])=>{if(n==='pelvis')return;q.x=clamp(p.x+(q.x-p.x)*.92,0,1);q.y=clamp(p.y+(q.y-p.y)*.92,0,1);changed.add(n);});
    }
    return {skeleton:s,changed:[...changed]};
  }

  function torsoUnit(s){
    const a=point(s,'pelvis'),b=point(s,'chest');
    return Math.max(.08,Math.hypot(b.x-a.x,b.y-a.y));
  }

  function targetCanvasPoints(reference, rig, canvasRect, strength='close'){
    if(!reference||!rig?.pelvis||!rig?.chest)return {};
    const refPel=point(reference,'pelvis');
    const refUnit=torsoUnit(reference);
    const rigPel={x:rig.pelvis.x*canvasRect.width,y:rig.pelvis.y*canvasRect.height};
    const rigChest={x:rig.chest.x*canvasRect.width,y:rig.chest.y*canvasRect.height};
    const rigUnit=Math.max(30,Math.hypot(rigChest.x-rigPel.x,rigChest.y-rigPel.y));
    const factor=strength==='loose'?.78:strength==='strict'?1.06:1;
    const scale=(rigUnit/refUnit)*factor;
    const out={};
    for(const n of NAMES){
      const p=reference[n];if(!p||!rig[n])continue;
      out[n]={
        x:(rigPel.x+(p.x-refPel.x)*scale)/canvasRect.width,
        y:(rigPel.y+(p.y-refPel.y)*scale)/canvasRect.height
      };
    }
    return out;
  }

  window.MPHPoseEngine={NAMES,defaultSkeleton,clone,mirror,parseCommand,targetCanvasPoints};
})();
