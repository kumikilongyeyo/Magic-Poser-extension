(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  async function snapshotCanvas(canvas){
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width)), h=Math.max(1,Math.round(rect.height));
    const maxW=1100, scale=Math.min(1,maxW/w);
    const ow=Math.max(1,Math.round(w*scale)), oh=Math.max(1,Math.round(h*scale));
    const out=document.createElement('canvas');
    out.width=ow; out.height=oh;
    const ctx=out.getContext('2d',{willReadFrequently:true});
    try{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      ctx.drawImage(canvas,0,0,ow,oh);
      const data=ctx.getImageData(0,0,ow,oh);
      let min=255,max=0;
      for(let i=0;i<data.data.length;i+=64){
        const y=.2126*data.data[i]+.7152*data.data[i+1]+.0722*data.data[i+2];
        min=Math.min(min,y);max=Math.max(max,y);
      }
      if(max-min<8)return null;
      return {data,w:ow,h:oh};
    }catch{return null;}
  }

  function detectCompactDarkBlobs(image){
    const {data,w,h}=image, px=data.data;
    const mask=new Uint8Array(w*h);
    for(let i=0,p=0;i<px.length;i+=4,p++){
      const y=.2126*px[i]+.7152*px[i+1]+.0722*px[i+2];
      if(y<92)mask[p]=1;
    }
    const seen=new Uint8Array(w*h), out=[];
    const minDim=Math.min(w,h);
    const minSize=Math.max(4,minDim*.008), maxSize=Math.max(18,minDim*.07);
    const stack=[];

    for(let sy=0;sy<h;sy++)for(let sx=0;sx<w;sx++){
      const sidx=sy*w+sx;
      if(!mask[sidx]||seen[sidx])continue;
      stack.length=0;stack.push(sidx);seen[sidx]=1;
      let area=0,sumX=0,sumY=0,minX=sx,maxX=sx,minY=sy,maxY=sy,perim=0;
      while(stack.length){
        const idx=stack.pop(),x=idx%w,y=(idx/w)|0;
        area++;sumX+=x;sumY+=y;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
        const ns=[idx-1,idx+1,idx-w,idx+w];
        for(let k=0;k<4;k++){
          const ni=ns[k];
          const nx=k===0?x-1:k===1?x+1:x;
          const ny=k===2?y-1:k===3?y+1:y;
          if(nx<0||ny<0||nx>=w||ny>=h){perim++;continue;}
          if(!mask[ni]){perim++;continue;}
          if(!seen[ni]){seen[ni]=1;stack.push(ni);}
        }
      }
      const bw=maxX-minX+1,bh=maxY-minY+1;
      if(bw<minSize||bh<minSize||bw>maxSize||bh>maxSize)continue;
      const aspect=bw/bh,fill=area/(bw*bh),circ=perim?4*Math.PI*area/(perim*perim):0;
      if(aspect<.48||aspect>2.05||fill<.22||circ<.34)continue;
      out.push({x:(sumX/area)/w,y:(sumY/area)/h,fill,circ});
    }
    return out;
  }

  function align(rig,candidates){
    const names=Object.keys(rig||{});
    if(!names.length)return {rig,updated:0,confidence:0,candidates:candidates.length};
    const proposals=[];
    for(const name of names){
      const p=rig[name];let best=-1,bd=Infinity;
      for(let i=0;i<candidates.length;i++){
        const c=candidates[i],d=Math.hypot(c.x-p.x,c.y-p.y);
        if(d<bd){bd=d;best=i;}
      }
      if(best>=0)proposals.push({name,index:best,d:bd});
    }
    proposals.sort((a,b)=>a.d-b.d);
    const used=new Set(),next=JSON.parse(JSON.stringify(rig));
    let updated=0,total=0;
    for(const p of proposals){
      if(used.has(p.index)||p.d>.135)continue;
      used.add(p.index);const c=candidates[p.index];
      next[p.name]={x:clamp(c.x,0,1),y:clamp(c.y,0,1)};
      updated++;total+=p.d;
    }
    const avg=updated?total/updated:1;
    const confidence=clamp((updated/names.length)*(.135-Math.min(.135,avg))/.135,0,1);
    return {rig:next,updated,confidence,candidates:candidates.length,avgDistance:avg};
  }

  async function refresh(rig){
    const canvas=window.MPHVisualDriver?.getCanvas?.();
    if(!canvas)return {ok:false,reason:'no-canvas',rig,updated:0,candidates:0};
    const snap=await snapshotCanvas(canvas);
    if(!snap)return {ok:false,reason:'capture-unavailable',rig,updated:0,candidates:0};
    const candidates=detectCompactDarkBlobs(snap);
    if(candidates.length<5)return {ok:false,reason:'too-few-controls',rig,updated:0,candidates:candidates.length};
    const result=align(rig,candidates);
    return {...result,ok:result.updated>=6};
  }

  window.MPHControlScanner={refresh};
})();