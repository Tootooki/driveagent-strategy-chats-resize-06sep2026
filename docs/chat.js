import {chatViewportInsets} from './chat-viewport.mjs?v=74';
import {CHAT_STORAGE_KEY,LEGACY_CHAT_STORAGE_KEY,CHAT_GREETING,createChatState,activeChat,ensureProductChat,appendChatMessage,sortedChats,latestChat,savedChats,ensureStrategyChats,greetChat,localChatReply} from './chat-model.mjs?v=120';
import {attachColumnResizer,chatColumnWidth,chatColumnLimits} from './column-resizer.mjs?v=120';
import {createVoiceSession} from './voice-session.mjs?v=120';

const byId=id=>document.getElementById(id);
const widget=byId('chat-widget'),panel=byId('chat-popup'),launcher=byId('chat-launcher'),menu=byId('menu-backdrop'),shell=document.querySelector('.workbook-shell');
const messages=byId('chat-messages'),rooms=byId('chat-rooms'),conversation=byId('chat-conversation'),settings=byId('chat-settings'),status=byId('chat-status');
let restored,preferences={readReplies:true,voice:'',rate:1};
try{restored=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)||localStorage.getItem(LEGACY_CHAT_STORAGE_KEY));}catch{}
try{const saved=JSON.parse(localStorage.getItem('driveagent:voice-settings:v1'));if(saved)preferences={readReplies:saved.readReplies!==false,voice:typeof saved.voice==='string'?saved.voice:'',rate:[.85,1,1.2].includes(saved.rate)?saved.rate:1};}catch{}
const state=ensureStrategyChats(createChatState(restored));const pendingReplies=new Set();
const input=byId('chat-input'),form=byId('chat-form'),submit=byId('chat-submit');let opener=launcher,pageMode=false,view='messages';
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const room=()=>activeChat(state);
const setStatus=text=>{status.textContent=text;status.hidden=!text;};
const persist=()=>{try{localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify(savedChats(state)));}catch{setStatus('Saved for this visit only.');}};
const savePreferences=()=>{try{localStorage.setItem('driveagent:voice-settings:v1',JSON.stringify(preferences));}catch{}};
const scrollEnd=()=>{messages.scrollTop=messages.scrollHeight;};
const voice=createVoiceSession({host:window,getPreferences:()=>preferences,onChange:({mode,phase,message})=>{
  widget.dataset.voiceMode=mode;widget.dataset.voicePhase=phase;setStatus(message);
  byId('chat-live').setAttribute('aria-pressed',String(mode==='live'));byId('chat-live').setAttribute('aria-label',mode==='live'?'Stop live voice':'Start live voice');
  byId('chat-mic').setAttribute('aria-pressed',String(mode==='mic'));byId('chat-mic').setAttribute('aria-label',mode==='mic'?'Finish voice message':'Record a voice message');
},onTranscript:text=>{
  const id=state.active;appendChatMessage(state,id,'user',text);const reply=localChatReply(room());appendChatMessage(state,id,'assistant',reply);
  renderMessages();renderRooms();persist();scrollEnd();return reply;
}});
function renderRooms(){
  const top=rooms.scrollTop;rooms.replaceChildren();
  for(const item of sortedChats(state,{recentFirst:pageMode})){
    const button=element('button','room-button');button.type='button';button.dataset.chatId=item.id;button.setAttribute('aria-label',item.title+(item.unread?` · ${item.unread} unread`:''));
    if(item.id===state.active)button.setAttribute('aria-current','page');
    const avatar=element('span','room-avatar',item.emoji||(item.sku?item.title.slice(0,2).toUpperCase():'•••'));
    if(item.emoji){avatar.classList.add('room-emoji');avatar.setAttribute('aria-hidden','true');}
    if(item.image){const image=element('img');image.src=item.image;image.alt='';image.loading='lazy';avatar.replaceChildren(image);}button.append(avatar);
    const copy=element('span','room-copy');copy.append(element('strong','',item.title),element('span','room-preview',item.messages.at(-1)?.text||'Start a conversation'));button.append(copy);
    if(item.unread)button.append(element('span','room-unread',String(item.unread)));
    button.addEventListener('click',()=>selectRoom(item.id));rooms.append(button);
  }
  rooms.scrollTop=top;
}
function setView(next='messages'){
  view=pageMode&&next==='rooms'?'messages':next;
  rooms.hidden=!pageMode&&view!=='rooms';conversation.hidden=view==='rooms';settings.hidden=view!=='settings';messages.hidden=view!=='messages';
  byId('chat-settings-toggle').setAttribute('aria-expanded',String(view!=='messages'));
  panel.dataset.rooms=view==='rooms'?'open':'closed';panel.dataset.view=view;form.hidden=!pageMode||view!=='messages';
}
function renderMessages(){
  messages.replaceChildren();messages.setAttribute('aria-label',room().title+' messages');panel.dataset.chatId=state.active;
  for(const [index,item] of room().messages.entries()){
    const article=element('article','chat-message'+(item.role==='user'?' from-user':''));article.setAttribute('aria-label',item.role==='user'?'You':'Assistant');article.append(element('p','',item.text));
    const time=element('time','message-time',new Date(item.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}));time.dateTime=new Date(item.time).toISOString();const actions=element('div','message-actions');actions.append(time);
    const copy=messageButton('Copy message '+(index+1),'copy',()=>copyMessage(item.text));
    const read=messageButton('Read message '+(index+1),'read',()=>voice.preview(item.text));actions.append(copy,read);article.append(actions);messages.append(article);
  }
}
function messageButton(label,kind,handler){
  const button=element('button','message-button');button.type='button';button.setAttribute('aria-label',label);button.dataset.messageAction=kind;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',kind==='copy'?'M9 8h11v13H9zM5 16H3V3h11v2':'M4 9h4l5-4v14l-5-4H4zM16 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12');svg.append(path);button.append(svg);
  button.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});button.addEventListener('click',handler);return button;
}
async function copyMessage(text){try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(text);setStatus('COPIED');}catch{setStatus('Copy is unavailable here. Select the message text to copy it.');}}
function refreshComposer(){submit.disabled=!input.value.trim();input.style.height='44px';input.style.height=Math.min(84,Math.max(44,input.scrollHeight))+'px';}
function selectRoom(id){
  if(!state.rooms.some(item=>item.id===id))return;
  voice.stop();room().draft=input.value;state.active=id;room().unread=0;input.value=room().draft;refreshComposer();greetChat(state,id);setView();renderRooms();renderMessages();persist();scrollEnd();
}
function updateViewport(){
  if(panel.hidden)return;
  const bounds=pageMode?widget.parentElement:shell;
  const editing=panel.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  const fit=document.documentElement.hasAttribute('data-chrome-viewport')?{top:0,bottom:0,short:bounds.clientHeight<420,keyboard:document.documentElement.getAttribute('data-chrome-keyboard')==='true'}:chatViewportInsets({shell:bounds.getBoundingClientRect(),viewport:window.visualViewport,typing:editing,wasKeyboard:widget.dataset.keyboard==='true'});
  widget.style.setProperty('--chat-keyboard-inset',fit.bottom+'px');widget.style.setProperty('--chat-keyboard-top',fit.top+'px');widget.dataset.short=String(fit.short);widget.dataset.keyboard=String(fit.keyboard);
  const wasKeyboard=document.documentElement.hasAttribute('data-chat-keyboard');
  document.documentElement.toggleAttribute('data-chat-keyboard',pageMode&&fit.keyboard);
  if(wasKeyboard&&!document.documentElement.hasAttribute('data-chat-keyboard'))window.dispatchEvent(new Event('dolce:chat-keyboard-end'));
}
function syncLauncher(){
  const open=!panel.hidden&&!pageMode;launcher.hidden=pageMode||!menu.hidden;
  launcher.setAttribute('aria-expanded',String(open));launcher.setAttribute('aria-label',open?'Close chat':'Open main chat');
}
function closeChat({restoreFocus=true}={}){
  if(pageMode)return;
  const wasOpen=!panel.hidden;voice.stop();room().draft=input.value;persist();panel.hidden=true;widget.dataset.open='false';widget.dataset.keyboard='false';setView();syncLauncher();
  widget.style.setProperty('--chat-keyboard-inset','0px');widget.style.setProperty('--chat-keyboard-top','0px');
  if(panel.contains(document.activeElement))document.activeElement.blur();
  if(wasOpen&&restoreFocus)(opener?.isConnected&&!opener.closest('[hidden]')?opener:launcher).focus({preventScroll:true});
}
function openChat(id='main',source=launcher){
  if(!menu.hidden)return;opener=source;panel.hidden=false;widget.dataset.open='true';selectRoom(id);syncLauncher();updateViewport();panel.focus({preventScroll:true});
}
launcher.addEventListener('click',()=>{if(panel.hidden)openChat('main');else closeChat();});
byId('chat-settings-toggle').addEventListener('click',()=>{voice.stop();setView(view==='messages'?'settings':'messages');});
byId('chat-rooms-toggle').addEventListener('click',()=>setView('rooms'));
byId('chat-live').addEventListener('click',()=>{input.blur();setView();voice.toggleLive();});
byId('chat-mic').addEventListener('click',()=>{input.blur();setView();voice.toggleMic();});
byId('chat-test-voice').addEventListener('click',()=>voice.preview(CHAT_GREETING));
byId('chat-read-last').addEventListener('click',()=>{const last=room().messages.findLast(item=>item.role==='assistant');if(last)voice.preview(last.text);});
byId('chat-read-replies').setAttribute('aria-pressed',String(preferences.readReplies));
byId('chat-read-replies').addEventListener('click',event=>{preferences.readReplies=!preferences.readReplies;event.currentTarget.setAttribute('aria-pressed',String(preferences.readReplies));savePreferences();});
byId('chat-speed').value=String(preferences.rate);byId('chat-speed').addEventListener('change',event=>{preferences.rate=Number(event.target.value);savePreferences();});
function loadVoices(){const select=byId('chat-voice');select.replaceChildren(new Option('DEVICE DEFAULT',''));for(const item of window.speechSynthesis?.getVoices()||[])select.append(new Option(item.name+' · '+item.lang,item.voiceURI));select.value=preferences.voice;if(select.selectedIndex<0)select.value='';}
loadVoices();window.speechSynthesis?.addEventListener?.('voiceschanged',loadVoices);
byId('chat-voice').addEventListener('change',event=>{preferences.voice=event.target.value;savePreferences();});
document.addEventListener('dolce:product-chat',event=>{const target=ensureProductChat(state,event.detail);if(target)openChat(target.id,event.detail.opener);});
document.addEventListener('keydown',event=>{if(!pageMode&&!event.defaultPrevented&&event.key==='Escape'&&!panel.hidden){event.preventDefault();if(view!=='messages'){voice.stop();setView();byId('chat-settings-toggle').focus({preventScroll:true});}else closeChat();}});
function syncMenu(){if(!menu.hidden){voice.stop();if(!pageMode)closeChat({restoreFocus:false});}syncLauncher();}
new MutationObserver(syncMenu).observe(menu,{attributes:true,attributeFilter:['hidden']});
byId('header-home').addEventListener('click',()=>{voice.stop();closeChat({restoreFocus:false});});
document.addEventListener('dolce:ppc-controls-change',event=>{if(event.detail.open){voice.stop();if(!pageMode)closeChat({restoreFocus:false});}requestAnimationFrame(updateViewport);});
panel.addEventListener('focusin',updateViewport);panel.addEventListener('focusout',()=>requestAnimationFrame(updateViewport));
window.addEventListener('pageshow',updateViewport);window.addEventListener('resize',updateViewport,{passive:true});window.addEventListener('dolce:viewportchange',updateViewport);
window.visualViewport?.addEventListener('resize',updateViewport,{passive:true});window.visualViewport?.addEventListener('scroll',updateViewport,{passive:true});
window.addEventListener('pagehide',event=>{voice.stop();room().draft=input.value;persist();if(!event.persisted)for(const timer of pendingReplies)clearTimeout(timer);});document.addEventListener('visibilitychange',()=>{if(document.hidden)voice.stop();});
function leaveChatPage(){
  if(!pageMode)return;voice.stop();room().draft=input.value;pageMode=false;document.documentElement.removeAttribute('data-chat-keyboard');byId('chat-column-resizer').hidden=true;delete widget.dataset.page;shell.append(widget);panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');setView();closeChat({restoreFocus:false});syncMenu();
}
function syncWorkspace(){
  if(document.body.dataset.activeWorkspace!=='chat'){leaveChatPage();return;}
  const host=byId('module-workspace');if(!host)return;const entering=!pageMode;pageMode=true;widget.dataset.page='true';if(widget.parentElement!==host)host.append(widget);
  panel.setAttribute('role','region');panel.removeAttribute('aria-modal');panel.hidden=false;widget.dataset.open='true';
  if(entering)selectRoom(latestChat(state).id);else setView();byId('chat-column-resizer').hidden=false;syncMenu();refreshListWidth();updateViewport();
}
function refreshProductImages(view=window.dolceSheetView){
  let changed=false;for(const product of view?.rows||[]){if(product.isHeader||product.isTotal||!product.image)continue;const existing=state.rooms.find(item=>item.sku&&item.sku===product.sku);if(existing&&existing.image!==product.image){ensureProductChat(state,product);changed=true;}}
  if(changed){renderRooms();persist();}
}
window.addEventListener('dolce:workspace-changing',event=>{voice.stop();if(event.detail.active!=='chat')leaveChatPage();});
window.addEventListener('dolce:workspace-change',syncWorkspace);document.addEventListener('dolce:sheet-render',event=>refreshProductImages(event.detail));
let chatWidthRatio=null;try{const saved=Number(localStorage.getItem('driveagent:chat-list-width:v1'));if(saved>0&&saved<1)chatWidthRatio=saved;}catch{}
const listSize=()=>panel.clientWidth||window.innerWidth||390;
function refreshListWidth(){const width=chatColumnWidth(listSize(),chatWidthRatio);widget.style.setProperty('--chat-list-width',width+'px');widget.dataset.narrowList=String(width<80);listResizer.refresh();}
const listResizer=attachColumnResizer({root:widget,handle:byId('chat-column-resizer'),readWidth:()=>chatColumnWidth(listSize(),chatWidthRatio),limits:()=>chatColumnLimits(listSize()),enabled:()=>pageMode&&!panel.hidden,
  setWidth:width=>{chatWidthRatio=width/listSize();try{localStorage.setItem('driveagent:chat-list-width:v1',String(chatWidthRatio));}catch{}refreshListWidth();},
  reset:()=>{chatWidthRatio=null;try{localStorage.removeItem('driveagent:chat-list-width:v1');}catch{}refreshListWidth();}});
window.addEventListener('resize',()=>{listResizer.cancel();refreshListWidth();});
if(window.ResizeObserver){const observer=new ResizeObserver(()=>{if(pageMode)refreshListWidth();});observer.observe(panel);}
input.addEventListener('input',()=>{room().draft=input.value;refreshComposer();persist();});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
submit.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});
form.addEventListener('submit',event=>{
  event.preventDefault();if(!pageMode||view!=='messages'||!input.value.trim())return;
  const id=state.active,text=input.value;voice.stop();appendChatMessage(state,id,'user',text);input.value='';room().draft='';refreshComposer();renderMessages();renderRooms();persist();scrollEnd();
  const target=room();const timer=setTimeout(()=>{pendingReplies.delete(timer);appendChatMessage(state,id,'assistant',localChatReply(target));renderRooms();if(state.active===id){const nearBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80,top=messages.scrollTop;renderMessages();if(nearBottom)scrollEnd();else messages.scrollTop=top;}persist();},350);pendingReplies.add(timer);
});
input.value=room().draft;refreshComposer();refreshProductImages();renderRooms();renderMessages();syncMenu();syncWorkspace();
