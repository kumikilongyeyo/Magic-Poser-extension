(() => {
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function getCanvas(){
    const candidates=[...document.querySelectorAll('canvas')].filter(c=>{
      const r=c.getBoundingClientRect();return r.width>400&&r.height>300;
    });
    return candidates.sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0]||null;
  }

  function clientPoint(canvas,norm){
    const r=canvas.getBoundingClientRect();
    return {x:r.left+clamp(norm.x,0,1)*r.width,y:r.top+clamp(norm.y,0,1)*r.height};
  }

  function dispatchMouse(canvas,type,p,buttons=0){
    const common={bubbles:true,cancelable:true,view:window,clientX:p.x,clientY:p.y,screenX:p.x,screenY:p.y,button:0,buttons};
    try{canvas.dispatchEvent(new PointerEvent(type.startsWith('pointer')?type:type.replace('mouse','pointer'),{...common,pointerId:1,pointerType:'mouse',isPrimary:true}));}catch{}
    try{canvas.dispatchEvent(new MouseEvent(type,{...common}));}catch{}
  }

  async function drag(canvas,fromNorm,toNorm,{duration=180,steps=10}={}){
    const a=clientPoint(canvas,fromNorm),b=clientPoint(canvas,toNorm);
    dispatchMouse(canvas,'mousedown',a,1); await sleep(18);
    for(let i=1;i<=steps;i++){
      const t=i/steps; const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      dispatchMouse(canvas,'mousemove',{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e},1);
      await sleep(duration/steps);
    }
    dispatchMouse(canvas,'mouseup',b,0); await sleep(24);
  }

  async function apply(rig,target,{scope='whole',keepFeet=false,strength='close',onProgress}={}){
    const canvas=getCanvas();if(!canvas)throw new Error('Magic Poser canvas not found.');
    const groups={
      upper:['chest','head','leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist'],
      lower:['pelvis','leftKnee','rightKnee','leftAnkle','rightAnkle'],
      whole:['pelvis','chest','head','leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftKnee','rightKnee','leftAnkle','rightAnkle']
    };
    let order=[...(groups[scope]||groups.whole)];
    if(keepFeet)order=order.filter(n=>!['leftAnkle','rightAnkle'].includes(n));
    order=order.filter(n=>rig[n]&&target[n]);
    const before=JSON.parse(JSON.stringify(rig));
    const duration=strength==='strict'?250:strength==='loose'?130:180;
    for(let i=0;i<order.length;i++){
      const n=order[i];onProgress?.(i+1,order.length,n);
      await drag(canvas,rig[n],target[n],{duration,steps:strength==='strict'?15:10});
      rig[n]={...target[n]};
    }
    return {before,after:JSON.parse(JSON.stringify(rig)),count:order.length};
  }

  async function restore(current,previous,{onProgress}={}){
    const canvas=getCanvas();if(!canvas)throw new Error('Magic Poser canvas not found.');
    const names=Object.keys(previous).filter(n=>current[n]&&previous[n]);
    for(let i=0;i<names.length;i++){
      const n=names[i];onProgress?.(i+1,names.length,n);
      await drag(canvas,current[n],previous[n],{duration:140,steps:9});current[n]={...previous[n]};
    }
  }

  window.MPHVisualDriver={getCanvas,apply,restore};
})();
