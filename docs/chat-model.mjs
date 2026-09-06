import {STRATEGY_CHATS} from './chat-catalog.mjs?v=120';
export {STRATEGY_CHATS};
// Local conversation state. Product identity always uses the original SKU.
export const CHAT_STORAGE_KEY='driveagent:strategy-chats:v2';
export const LEGACY_CHAT_STORAGE_KEY='driveagent:product-chats:v1';
const clean=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
// Only packaged product images; saved chat content cannot load arbitrary URLs.
const productImage=value=>typeof value==='string'&&/^product-images\/[a-z0-9_./-]+\.(png|jpe?g|webp)$/i.test(value)&&!value.includes('..')?value:'';
const newRoom=(id,title,sku='',now=Date.now())=>({id,title,sku,messages:[],draft:'',unread:0,updatedAt:now});
export function createChatState(saved){
  const state={active:'main',rooms:[newRoom('main','MAINCHAT','',0)]};
  if(saved?.version!==1||!Array.isArray(saved.rooms))return state;
  const seen=new Set();
  for(const item of saved.rooms.slice(0,200)){
    const strategy=STRATEGY_CHATS.find(chat=>chat.id===item?.id);
    const sku=strategy?'':clean(item?.sku,100),id=strategy?.id||(sku?'product:'+sku:'main');
    if(!item||item.id!==id||seen.has(id))continue;seen.add(id);
    const room=newRoom(id,strategy?.title||(sku?clean(item.title,100)||sku:'MAINCHAT'),sku,Number(item.updatedAt)||0);
    if(strategy)Object.assign(room,strategy,{kind:'strategy'});
    room.image=strategy?'':productImage(item.image);room.draft=clean(item.draft);room.unread=Math.max(0,Math.min(999,Number(item.unread)||0));
    room.messages=(Array.isArray(item.messages)?item.messages:[]).slice(-200).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string').map(m=>({role:m.role,text:clean(m.text),time:Number(m.time)||0}));
    if(id==='main')state.rooms[0]=room;else state.rooms.push(room);
  }
  return state;
}
export const activeChat=state=>state.rooms.find(room=>room.id===state.active)||state.rooms[0];
export function ensureProductChat(state,product,now=Date.now()){
  const sku=clean(product?.sku,100).trim();if(!sku)return null;
  const id='product:'+sku;let room=state.rooms.find(item=>item.id===id);
  if(!room){room=newRoom(id,clean(product.title,100)||sku,sku,now);state.rooms.push(room);}
  const image=productImage(product.image);if(image)room.image=image;
  return room;
}
export function appendChatMessage(state,id,role,text,now=Date.now()){
  const room=state.rooms.find(item=>item.id===id),value=clean(text).trim();
  if(!room||!value||!['user','assistant'].includes(role))return null;
  const message={role,text:value,time:now};room.messages.push(message);room.updatedAt=now;
  if(role==='assistant'&&state.active!==id)room.unread++;
  return message;
}
export function sortedChats(state,{recentFirst=false}={}){return [...state.rooms].sort((a,b)=>recentFirst?b.updatedAt-a.updatedAt:a.id==='main'?-1:b.id==='main'?1:b.updatedAt-a.updatedAt);}
export const latestChat=state=>sortedChats(state,{recentFirst:true})[0];
export function savedChats(state){return {version:1,rooms:state.rooms};}
export function localChatReply(room){return `Message saved in ${room.title}. Live AI isn’t connected in this demo yet.`;}

export const CHAT_GREETING='Hello, how are you? I am ready to assist you.';
export function greetChat(state,id,now=Date.now()){const room=state.rooms.find(item=>item.id===id);if(!room||room.messages.length)return false;room.messages.push({role:'assistant',text:CHAT_GREETING,time:now});return true;}

export function ensureStrategyChats(state){for(const entry of STRATEGY_CHATS){if(!state.rooms.some(room=>room.id===entry.id))state.rooms.push({...newRoom(entry.id,entry.title,'',0),...entry,kind:'strategy'});}return state;}
