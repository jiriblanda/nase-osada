import { randomBytes, createHash } from 'node:crypto';
import { put, get, BlobPreconditionFailedError } from '@vercel/blob';

const CYCLE_MS=10*60*1000;
const PRESENCE_MS=45*1000;
const ROOM_LIMIT=6;
const MAX_REQUEST_BYTES=4096;
const resourceKeys=['wood','stone','food','water','gold'];
const storePath=code=>'rooms/v1/'+code+'.json';
const cleanName=v=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,24):'';
const validCode=v=>typeof v==='string'&&/^[A-HJ-NP-Z2-9]{12}$/.test(v);
const validId=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const hash=x=>createHash('sha256').update(x).digest('hex');
const json=(res,status,body)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.status(status).json(body)};
const problem=(code,message,status=400)=>Object.assign(new Error(message),{status,code});

async function read(code){
 const blob=await get(storePath(code),{access:'private',useCache:false});
 if(!blob)return null;
 const raw=await new Response(blob.stream).text();
 return {room:JSON.parse(raw),etag:blob.etag};
}
async function write(room,etag){
 const options={access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:0};
 if(etag){options.allowOverwrite=true;options.ifMatch=etag}
 await put(storePath(room.code),JSON.stringify(room),options);
}
function members(room){return Object.values(room.members||{})}
function active(room,now){return members(room).filter(m=>m.seenAt>0&&now-m.seenAt<PRESENCE_MS)}
function accrued(room,now){
 const last=Number(room.countedAt)||now;
 const bound=Math.max(0,...members(room).map(m=>m.seenAt>0?m.seenAt+PRESENCE_MS:0));
 const elapsed=Math.max(0,Math.min(now,bound)-last);
 room.progressMs=Math.max(0,Number(room.progressMs)||0)+elapsed;
 room.countedAt=now;
 const cycles=Math.floor(room.progressMs/CYCLE_MS);
 if(cycles){
  room.progressMs%=CYCLE_MS;
  for(let i=0;i<cycles;i++){
   const gains={wood:0,stone:0,food:0,water:0,gold:0};
   for(const b of room.buildings||[]){
    if(!b||!resourceKeys.includes(b.resource))continue;
    gains[b.resource]+=2+Math.min(5,Math.max(1,Number(b.level)||1));
   }
   let free=Math.max(0,Number(room.capacity||30)-resourceKeys.reduce((a,k)=>a+(room.resources[k]||0),0));
   for(const k of resourceKeys){const n=Math.min(free,gains[k]);room.resources[k]=(room.resources[k]||0)+n;free-=n}
  }
  room.cycles=(room.cycles||0)+cycles;
 }
 return cycles;
}
function assertMember(room,id,token){
 if(!validId(id)||typeof token!=='string'||token.length!==64)throw problem('LOGIN_REQUIRED','Chybí přístup hráče.',403);
 const member=room.members[id];
 if(!member||hash(token)!==member.tokenHash)throw problem('LOGIN_REQUIRED','Přístup hráče nebyl ověřen.',403);
 return member;
}
function publicState(room,now){
 const a=active(room,now);
 return {
  code:room.code,
  createdAt:room.createdAt,
  savedAt:room.savedAt,
  paused:a.length===0,
  activeCount:a.length,
  members:members(room).map(m=>({id:m.id,name:m.name,character:m.character,online:a.some(x=>x.id===m.id)})),
  resources:room.resources,
  capacity:room.capacity,
  buildings:(room.buildings||[]).map(({id,type,resource,level})=>({id,type,resource,level})),
  tentBuilt:!!room.tentBuilt,
  productionCycleMs:CYCLE_MS,
  remainingMs:CYCLE_MS-room.progressMs,
  completedCycles:room.cycles||0
 };
}
function shapePlayer(x){return {name:cleanName(x.name),character:cleanName(x.character)||'Erik'}}
function isRetryable(e){return e instanceof BlobPreconditionFailedError||e?.name==='BlobPreconditionFailedError'||e?.status===412}
async function mutate(code,change){
 for(let attempt=0;attempt<6;attempt++){
  const item=await read(code);
  if(!item)throw problem('ROOM_NOT_FOUND','Tato místnost neexistuje.',404);
  const room=item.room,now=Date.now();
  accrued(room,now);
  const response=change(room,now);
  room.savedAt=now;
  try{await write(room,item.etag);return response(room,now)}catch(e){if(isRetryable(e)&&attempt<5)continue;throw e}
 }
 throw problem('WRITE_CONFLICT','Místnost je právě upravována. Zkus to znovu.',409);
}
export default async function handler(req,res){
 try{
  if(req.method==='GET'){
   if(req.query.action==='health')return json(res,200,{ok:true,service:'zk-room-v1',persistentStorage:!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.VERCEL_OIDC_TOKEN)});
   const {code,id,token}=req.query;
   if(!validCode(code))throw problem('INVALID_CODE','Neplatný kód místnosti.');
   const saved=await read(code);
   if(!saved)throw problem('ROOM_NOT_FOUND','Místnost nebyla nalezena.',404);
   assertMember(saved.room,id,token);
   const now=Date.now();
   accrued(saved.room,now);
   return json(res,200,{ok:true,room:publicState(saved.room,now)});
  }
  if(req.method!=='POST')return json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  const body=typeof req.body==='object'&&req.body?req.body:JSON.parse(req.body||'{}');
  if(Buffer.byteLength(JSON.stringify(body))>MAX_REQUEST_BYTES)throw problem('TOO_LARGE','Příliš dlouhý požadavek.',413);
  const action=body.action;
  if(action==='create'){
   const player=shapePlayer(body);
   if(!player.name)throw problem('NAME_REQUIRED','Nejdřív zadej jméno.');
   const id=randomBytes(16).toString('hex'),token=randomBytes(32).toString('hex');
   for(let i=0;i<5;i++){
    const code=Array.from(randomBytes(12),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).slice(0,12).join('');
    const now=Date.now();
    const room={version:1,code,createdAt:now,savedAt:now,countedAt:now,progressMs:0,cycles:0,capacity:30,
     resources:{wood:2,stone:2,food:2,water:1,gold:0},
     tentBuilt:false,
     buildings:[{id:'spring',type:'Studna',resource:'water',level:1}],
     members:{[id]:{id,name:player.name,character:player.character,tokenHash:hash(token),seenAt:now}}};
    try{await write(room,null);return json(res,200,{ok:true,code,id,token,room:publicState(room,now)})}
    catch(e){if(e?.name==='BlobAlreadyExistsError')continue;throw e}
   }
   throw problem('CREATE_FAILED','Místnost se nepodařilo vytvořit.',500);
  }
  const code=String(body.code||'').toUpperCase().replace(/[\s-]/g,'');
  if(!validCode(code))throw problem('INVALID_CODE','Zadej dvanáctimístný kód místnosti.');
  if(action==='join'){
   const player=shapePlayer(body);
   if(!player.name)throw problem('NAME_REQUIRED','Zadej své jméno.');
   const id=randomBytes(16).toString('hex'),token=randomBytes(32).toString('hex');
   const result=await mutate(code,(room,now)=>{
    if(members(room).length>=ROOM_LIMIT)throw problem('ROOM_FULL','Místnost je plná (maximálně 6 hráčů).',409);
    room.members[id]={id,name:player.name,character:player.character,tokenHash:hash(token),seenAt:now};
    return (updated,at)=>({ok:true,code,id,token,room:publicState(updated,at)});
   });
   return json(res,200,result);
  }
  if(!['pulse','leave','buildTent'].includes(action))throw problem('UNKNOWN_ACTION','Nepodporovaná akce.');
  const result=await mutate(code,(room,now)=>{
   const p=assertMember(room,body.id,body.token);
   if(action==='leave')p.seenAt=0;
   else p.seenAt=now;
   if(action==='buildTent'){
    if(room.tentBuilt)throw problem('ALREADY_BUILT','Stan už je postavený.');
    if(room.resources.wood<2||room.resources.stone<2)throw problem('NOT_ENOUGH','Na stan potřebujete 2 dřeva a 2 kameny.',409);
    room.resources.wood-=2;room.resources.stone-=2;room.tentBuilt=true;
   }
   return (updated,at)=>({ok:true,room:publicState(updated,at)});
  });
  return json(res,200,result);
 }catch(e){
  const code=e.code||'SERVER_ERROR';
  const status=e.status||500;
  if(status===500)console.error('Room API error',e);
  return json(res,status,{ok:false,error:code,message:status===500?'Ukládání není právě dostupné.':e.message});
 }
}
