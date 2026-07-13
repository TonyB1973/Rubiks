const FACE_COLORS={U:'#f5f5f2',D:'#f2c94c',F:'#22a06b',B:'#2878d0',R:'#e34b4b',L:'#f08a24'};
const NORMAL_FACE={'0,1,0':'U','0,-1,0':'D','0,0,1':'F','0,0,-1':'B','1,0,0':'R','-1,0,0':'L'};
const canvas=document.getElementById('cubeCanvas'),ctx=canvas.getContext('2d');
let stickers=[],history=[],undoStack=[],yaw=-35*Math.PI/180,pitch=-25*Math.PI/180,dragging=false,lastX=0,lastY=0;
let animation=null,algorithmMoves=[],algorithmIndex=0,deferredPrompt=null;

function initialStickers(){
 const out=[]; const coords=[-1,0,1];
 for(const x of coords)for(const z of coords)out.push({p:[x,1,z],n:[0,1,0],c:'U'});
 for(const x of coords)for(const z of coords)out.push({p:[x,-1,z],n:[0,-1,0],c:'D'});
 for(const x of coords)for(const y of coords)out.push({p:[x,y,1],n:[0,0,1],c:'F'});
 for(const x of coords)for(const y of coords)out.push({p:[x,y,-1],n:[0,0,-1],c:'B'});
 for(const z of coords)for(const y of coords)out.push({p:[1,y,z],n:[1,0,0],c:'R'});
 for(const z of coords)for(const y of coords)out.push({p:[-1,y,z],n:[-1,0,0],c:'L'});
 return out;
}
function resetCube(){stickers=initialStickers();history=[];undoStack=[];algorithmIndex=0;renderAll()}
function rot(v,axis,q){let [x,y,z]=v;for(let i=0;i<((q%4)+4)%4;i++){if(axis==='x')[y,z]=[-z,y];if(axis==='y')[x,z]=[z,-x];if(axis==='z')[x,y]=[-y,x]}return [x,y,z]}
const moves={U:{axis:'y',layer:1,q:-1},D:{axis:'y',layer:-1,q:1},R:{axis:'x',layer:1,q:-1},L:{axis:'x',layer:-1,q:1},F:{axis:'z',layer:1,q:-1},B:{axis:'z',layer:-1,q:1}};
function commitMove(token,record=true){
 const base=token[0],prime=token.includes("'"),twice=token.includes('2'),m=moves[base]; if(!m)return;
 let q=m.q*(prime?-1:1); const times=twice?2:1;
 for(let t=0;t<times;t++) for(const s of stickers){const ai={x:0,y:1,z:2}[m.axis];if(s.p[ai]===m.layer){s.p=rot(s.p,m.axis,q);s.n=rot(s.n,m.axis,q)}}
 if(record){history.push(token);undoStack.push(token)}
 updateStatus();draw();
}
function inverse(t){if(t.includes('2'))return t;return t.includes("'")?t[0]:t+"'"}
function isSolved(){return stickers.every(s=>s.c===NORMAL_FACE[s.n.join(',')])}
function updateStatus(){document.getElementById('history').textContent=history.length?history.join(' '):'No moves yet';document.getElementById('moveCount').textContent=`${history.length} move${history.length===1?'':'s'}`;const solved=isSolved();document.getElementById('statusText').textContent=solved?'Solved':'In progress';document.getElementById('statusDot').style.background=solved?'var(--ok)':'var(--accent)'}

const moveQueue=[];
let animating=false;
function requestMove(token,record=true,after=null){moveQueue.push({token,record,after});runMoveQueue()}
function runMoveQueue(){
 if(animating||!moveQueue.length)return;
 const job=moveQueue.shift(),base=job.token[0],m=moves[base];if(!m){runMoveQueue();return}
 const prime=job.token.includes("'"),twice=job.token.includes('2');
 const q=m.q*(prime?-1:1),quarterTurns=twice?2:1;
 animating=true;animation={token:job.token,axis:m.axis,layer:m.layer,q,start:performance.now(),duration:twice?440:280,angle:q*quarterTurns*Math.PI/2};
 function frame(now){
  const t=Math.min(1,(now-animation.start)/animation.duration),ease=1-Math.pow(1-t,3);
  animation.currentAngle=animation.angle*ease;draw();
  if(t<1)requestAnimationFrame(frame);else{
   const done=animation;animation=null;commitMove(done.token,job.record);animating=false;if(job.after)job.after();runMoveQueue();
  }
 }
 requestAnimationFrame(frame)
}
function scramble(){const faces=['U','D','L','R','F','B'],mods=['',"'",'2'];let seq=[],last='';const len=+document.getElementById('scrambleLength').value;for(let i=0;i<len;i++){let f;do{f=faces[Math.floor(Math.random()*faces.length)]}while(f===last);last=f;seq.push(f+mods[Math.floor(Math.random()*mods.length)])}seq.forEach(m=>requestMove(m,true))}

function camera(v){let [x,y,z]=v;let cy=Math.cos(yaw),sy=Math.sin(yaw);[x,z]=[x*cy+z*sy,-x*sy+z*cy];let cp=Math.cos(pitch),sp=Math.sin(pitch);[y,z]=[y*cp-z*sp,y*sp+z*cp];return[x,y,z]}
function project(v,w,h){const [x,y,z]=camera(v),d=8,scale=Math.min(w,h)*0.205/(1-z/d);return[w/2+x*scale,h/2-y*scale,z]}
function rotateContinuous(v,axis,a){let[x,y,z]=v,c=Math.cos(a),s=Math.sin(a);if(axis==='x')return[x,y*c-z*s,y*s+z*c];if(axis==='y')return[x*c+z*s,y,-x*s+z*c];return[x*c-y*s,x*s+y*c,z]}
function transformed(v,layerPos){return animation&&layerPos===animation.layer?rotateContinuous(v,animation.axis,animation.currentAngle||0):v}
function faceBasis(n){if(Math.abs(n[0])>.5)return[[0,1,0],[0,0,1]];if(Math.abs(n[1])>.5)return[[1,0,0],[0,0,1]];return[[1,0,0],[0,1,0]]}
function add(a,b,k=1){return[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k]}
function cubieVertices(p,half=.47){const[x,y,z]=p;return[[x-half,y-half,z-half],[x+half,y-half,z-half],[x+half,y+half,z-half],[x-half,y+half,z-half],[x-half,y-half,z+half],[x+half,y-half,z+half],[x+half,y+half,z+half],[x-half,y+half,z+half]]}
const CUBE_FACES=[{idx:[4,5,6,7],n:[0,0,1]},{idx:[1,0,3,2],n:[0,0,-1]},{idx:[5,1,2,6],n:[1,0,0]},{idx:[0,4,7,3],n:[-1,0,0]},{idx:[7,6,2,3],n:[0,1,0]},{idx:[0,1,5,4],n:[0,-1,0]}];
function polygonItem(points,fill,stroke='#07090c',lineWidth=1.4){return{points,fill,stroke,lineWidth,z:points.reduce((a,p)=>a+camera(p)[2],0)/points.length}}
function draw(){
 const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
 const grad=ctx.createRadialGradient(w*.5,h*.42,20,w*.5,h*.5,Math.max(w,h)*.7);grad.addColorStop(0,'#26323e');grad.addColorStop(1,'#080d12');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const items=[],coords=[-1,0,1],axisIndex={x:0,y:1,z:2};
 for(const x of coords)for(const y of coords)for(const z of coords){
  if(x===0&&y===0&&z===0)continue;const p=[x,y,z],layerPos=animation?p[axisIndex[animation.axis]]:99;
  const verts=cubieVertices(p).map(v=>transformed(v,layerPos));
  for(const f of CUBE_FACES){const n=transformed(f.n,layerPos),camN=camera(n);if(camN[2]<=0)continue;items.push(polygonItem(f.idx.map(i=>verts[i]),'#12171d','#05070a',1.8))}
 }
 for(const s of stickers){
  const ai=animation?axisIndex[animation.axis]:0,layerPos=animation?s.p[ai]:99;
  const p=transformed(s.p,layerPos),n=transformed(s.n,layerPos),camN=camera(n);if(camN[2]<=0)continue;
  let[u,v]=faceBasis(s.n);u=transformed(u,layerPos);v=transformed(v,layerPos);
  const center=add(p,n,.486),half=.385;
  const pts=[add(add(center,u,-half),v,-half),add(add(center,u,half),v,-half),add(add(center,u,half),v,half),add(add(center,u,-half),v,half)];
  items.push(polygonItem(pts,FACE_COLORS[s.c],'#11161b',1.5));
 }
 items.sort((a,b)=>a.z-b.z);
 for(const it of items){const pts=it.points.map(p=>project(p,w,h));ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fillStyle=it.fill;ctx.fill();ctx.lineWidth=it.lineWidth;ctx.strokeStyle=it.stroke;ctx.stroke()}
}
function renderAll(){updateStatus();draw();renderAlgorithmQueue()}

const moveGrid=document.getElementById('moveGrid');['U','U\'','U2','D','D\'','D2','L','L\'','L2','R','R\'','R2','F','F\'','F2','B','B\'','B2'].forEach(m=>{const b=document.createElement('button');b.className='btn move-btn'+(m.includes("'")?' inverse':'');b.textContent=m;b.onclick=()=>requestMove(m);moveGrid.appendChild(b)});
document.getElementById('resetBtn').onclick=resetCube;document.getElementById('scrambleBtn').onclick=scramble;document.getElementById('undoBtn').onclick=()=>{if(animating)return;const t=undoStack.pop();if(t){requestMove(inverse(t),false,()=>{history.pop();renderAll()})}};document.getElementById('clearHistoryBtn').onclick=()=>{history=[];undoStack=[];updateStatus()};
document.getElementById('scrambleLength').oninput=e=>document.getElementById('scrambleLengthValue').textContent=e.target.value;
document.querySelectorAll('.view-preset').forEach(b=>b.onclick=()=>{yaw=+b.dataset.yaw*Math.PI/180;pitch=+b.dataset.pitch*Math.PI/180;draw()});
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-lastX)*.008;pitch+=(e.clientY-lastY)*.008;pitch=Math.max(-1.35,Math.min(1.35,pitch));lastX=e.clientX;lastY=e.clientY;draw()});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);window.addEventListener('resize',draw);

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.view).classList.add('active');setTimeout(draw,0)});

const practices=[['Sexy move',"R U R' U'"],['Sledgehammer',"R' F R F'"],['Right trigger',"R U R'"],['Left trigger',"L' U' L"],['Yellow cross',"F R U R' U' F'"]];
const practiceList=document.getElementById('practiceList');practices.forEach(([n,a])=>{const el=document.createElement('button');el.className='practice-item';el.innerHTML=`<strong>${n}</strong><code>${a}</code>`;el.onclick=()=>{document.getElementById('algorithmInput').value=a;loadAlgorithm()};practiceList.appendChild(el)});
function parseAlgorithm(s){return s.trim().split(/\s+/).filter(x=>/^[UDLRFB](2|'|2')?$/.test(x))}
function loadAlgorithm(){algorithmMoves=parseAlgorithm(document.getElementById('algorithmInput').value);algorithmIndex=0;renderAlgorithmQueue()}
function renderAlgorithmQueue(){const q=document.getElementById('algorithmQueue');if(!algorithmMoves.length){q.textContent='No valid moves loaded';return}q.innerHTML=algorithmMoves.map((m,i)=>`<span class="${i<algorithmIndex?'done':i===algorithmIndex?'current':''}">${m}</span>`).join(' ')}
document.getElementById('loadAlgorithmBtn').onclick=loadAlgorithm;document.getElementById('nextAlgorithmBtn').onclick=()=>{if(algorithmIndex<algorithmMoves.length){requestMove(algorithmMoves[algorithmIndex],true,()=>{algorithmIndex++;renderAlgorithmQueue()})}};

const guideData=[
 {title:'Know the cube',goal:'Understand centres, edges and corners before making moves.',body:'The six centre pieces define each face colour and never change position relative to one another. Edge pieces have two colours; corner pieces have three.',checks:['Hold the cube with white on top and green facing you.','Find one edge and one corner piece.','Practise U, R and F turns slowly.'],alg:'No algorithm yet — focus on accurate quarter turns.',tip:'A letter means turn that face clockwise while looking directly at that face. An apostrophe means anticlockwise.'},
 {title:'White cross',goal:'Build a white cross with matching side colours.',body:'Make a daisy around the yellow centre first: place the four white edge pieces around yellow. Match each edge side colour with its centre, then turn that face 180° to move white down.',checks:['Four white edges form a cross.','Each side colour lines up with its centre.'],alg:'Use simple face turns; no fixed algorithm is required.',tip:'Correct side alignment matters. A white cross alone is not enough.'},
 {title:'White corners',goal:'Complete the first white layer.',body:'Place a white corner above its destination at the front-right. Repeat the right trigger until the corner drops into place. Use the mirrored left trigger for a front-left corner.',checks:['White face is complete.','First-layer side colours form solid rows.'],alg:"Right: R U R'   •   Left: L' U' L",tip:'Keep the target corner directly above where it belongs.'},
 {title:'Middle layer',goal:'Insert the four non-yellow edges.',body:'Find a top edge without yellow. Match its front colour with the centre. Decide whether the other colour must travel right or left, then use the matching algorithm.',checks:['The first two layers are solved.','No yellow edge has been inserted into the middle.'],alg:"Right: U R U' R' U' F' U F\nLeft: U' L' U L U F U' F'",tip:'When a wrong edge is stuck in the middle, run either algorithm once to eject it.'},
 {title:'Yellow cross',goal:'Make a yellow cross on the top face.',body:'You may see a dot, an L shape or a line. Hold an L at the top-left corner, or hold a line horizontally, then perform the algorithm. Repeat as needed.',checks:['A yellow cross is visible on top.'],alg:"F R U R' U' F'",tip:'At this stage, ignore whether the side colours match.'},
 {title:'Position yellow edges',goal:'Match the yellow cross edges to the side centres.',body:'Turn U until at least two edges match. If two matching edges are adjacent, hold them at the back and right. If opposite, perform the algorithm once and reassess.',checks:['All four top edge side colours match their centres.'],alg:"R U R' U R U2 R'",tip:'You are positioning pieces, not orienting corners yet.'},
 {title:'Position yellow corners',goal:'Put each yellow corner in its correct location.',body:'A corner is correctly positioned when its three colours belong between the three surrounding centres, even if yellow is not facing upward. Hold a correct corner at front-right and repeat.',checks:['All four corners occupy the correct locations.'],alg:"U R U' L' U R' U' L",tip:'If no corner is correct, perform the algorithm once from any angle.'},
 {title:'Orient yellow corners',goal:'Twist the final corners to solve the cube.',body:'Turn the whole cube upside down. Place an unsolved corner at front-right. Repeat the right trigger until that corner is solved, then turn only the bottom layer to bring the next unsolved corner into front-right.',checks:['All six faces are solid colours.'],alg:"Repeat: R U R' U'",tip:'The cube will look scrambled during this step. Do not rotate the whole cube between corners.'}
];
const steps=document.getElementById('guideSteps');guideData.forEach((s,i)=>{const b=document.createElement('button');b.className='guide-step'+(i===0?' active':'');b.textContent=`${i+1}. ${s.title}`;b.onclick=()=>showGuide(i);steps.appendChild(b)});
function showGuide(i){document.querySelectorAll('.guide-step').forEach((b,j)=>b.classList.toggle('active',i===j));const s=guideData[i];document.getElementById('guideArticle').innerHTML=`<div class="guide-hero"><div class="step-number">${i+1}</div><div><h2>${s.title}</h2><p class="muted">${s.goal}</p></div></div><h3>What to do</h3><p>${s.body}</p><h3>Algorithm</h3><div class="algorithm-card">${s.alg.replace(/\n/g,'<br>')}</div><h3>Check before continuing</h3><div class="checklist">${s.checks.map(x=>`<div class="check-item">✓ ${x}</div>`).join('')}</div><h3>Coach tip</h3><div class="tip">${s.tip}</div><div class="button-row"><button class="btn primary" onclick="document.querySelector('[data-view=simulator]').click();document.getElementById('algorithmInput').value=${JSON.stringify(s.alg.split('\n')[0].replace(/^.*?: /,''))};loadAlgorithm()">Practise this algorithm</button></div>`}
showGuide(0);

const notation=[['U','Up face','Clockwise top-face turn'],['D','Down face','Clockwise bottom-face turn'],['L','Left face','Clockwise left-face turn'],['R','Right face','Clockwise right-face turn'],['F','Front face','Clockwise front-face turn'],['B','Back face','Clockwise back-face turn'],["'",'Prime mark','Turn the face anticlockwise'],['2','Double turn','Turn the face 180 degrees']];
document.getElementById('notationGrid').innerHTML=notation.map(([l,t,d])=>`<article class="panel notation-card"><span class="notation-letter">${l}</span><h3>${t}</h3><p class="muted">${d}</p><code>Example: ${['U','D','L','R','F','B'].includes(l)?l+"  "+l+"'  "+l+'2':'R'+l}</code></article>`).join('');

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden')});document.getElementById('installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
resetCube();loadAlgorithm();
