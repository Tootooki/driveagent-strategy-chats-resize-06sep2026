// Browser speech only. No API keys or application audio uploads.
export function createVoiceSession({host=globalThis,onChange=()=>{},onTranscript=()=>'',getPreferences=()=>({})}={}){
  let mode='off',phase='idle',epoch=0,recognition=null,timer=null,silences=0;
  const clear=()=>{if(timer!==null)host.clearTimeout(timer);timer=null;};
  const change=(next,message='')=>{phase=next;onChange({mode,phase,message});};
  const current=id=>id===epoch&&mode!=='off';
  function stop(message=''){
    epoch++;clear();const old=recognition;recognition=null;mode='off';
    if(old){old.onstart=old.onresult=old.onerror=old.onend=null;try{old.abort();}catch{}}
    host.speechSynthesis?.cancel();change('idle',message);
  }
  const fail=message=>stop(message);
  function watch(fn,ms){clear();timer=host.setTimeout(()=>{timer=null;fn();},ms);}
  function speak(text,id,done){
    if(!current(id))return;
    if(!host.speechSynthesis||!host.SpeechSynthesisUtterance){done(false);return;}
    const preferences=getPreferences(),utterance=new host.SpeechSynthesisUtterance(text);
    const selected=host.speechSynthesis.getVoices().find(voice=>voice.voiceURI===preferences.voice);
    if(selected){utterance.voice=selected;utterance.lang=selected.lang;}
    utterance.rate=Math.max(.75,Math.min(1.5,Number(preferences.rate)||1));
    let finished=false;
    const finish=ok=>{if(finished||!current(id))return;finished=true;clear();done(ok);};
    utterance.onend=()=>finish(true);utterance.onerror=()=>finish(false);
    change('speaking','SPEAKING');
    watch(()=>{host.speechSynthesis.cancel();finish(false);},Math.min(60000,Math.max(12000,text.length*140)));
    try{host.speechSynthesis.speak(utterance);}catch{finish(false);}
  }
  function listen(id){
    if(!current(id))return;
    const Recognition=host.SpeechRecognition||host.webkitSpeechRecognition;
    if(!Recognition){fail('Microphone transcription is unavailable here. Try Safari or TEST VOICE in settings.');return;}
    let recognizer;try{recognizer=new Recognition();}catch{fail('Microphone transcription is unavailable here. Try TEST VOICE in settings.');return;}
    recognition=recognizer;let finalText='',requestedStop=false;const finalParts=new Map();
    recognizer.lang=getPreferences().language||host.navigator?.language||'en-US';recognizer.continuous=false;recognizer.interimResults=true;recognizer.maxAlternatives=1;
    change('starting','STARTING MICROPHONE');
    // Some iOS embedded browsers expose the constructor but never start it.
    watch(()=>{if(current(id))fail('The microphone did not start. Try Safari or TEST VOICE in settings.');},12000);
    recognizer.onstart=()=>{if(!current(id)||recognition!==recognizer)return;change('listening','LISTENING');watch(()=>{if(current(id))fail('Listening stopped. Tap the microphone to try again.');},60000);};
    recognizer.onresult=event=>{
      if(!current(id)||recognition!==recognizer)return;
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i],text=result[0]?.transcript||'';
        if(result.isFinal)finalParts.set(i,text);else interim+=text;
      }
      finalText=[...finalParts.values()].join(' ');
      change('listening',interim||'LISTENING');
      if(finalText&&!requestedStop){requestedStop=true;watch(()=>{if(current(id))fail('Transcription did not finish. Tap the microphone to try again.');},8000);try{recognizer.stop();}catch{}}
    };
    recognizer.onerror=event=>{
      if(!current(id)||recognition!==recognizer)return;
      if(event.error==='no-speech'&&mode==='live'){clear();recognition=null;try{recognizer.abort();}catch{}change('waiting','LIVE VOICE · READY');watch(()=>listen(id),Math.min(3000,600*(++silences)));return;}
      const errors={'not-allowed':'Microphone access was not allowed. Enable it in your browser to use voice.','service-not-allowed':'Speech recognition is unavailable in this browser. Try Safari or TEST VOICE.','audio-capture':'No microphone is available. Check your device microphone.','network':'Speech recognition could not connect. Check your connection and try again.','no-speech':'No speech was heard. Tap the microphone to try again.','language-not-supported':'This speech language is unavailable on your device.'};
      fail(errors[event.error]||'Voice stopped. Tap the microphone to try again.');
    };
    recognizer.onend=async()=>{
      if(!current(id)||recognition!==recognizer)return;
      recognition=null;clear();const text=finalText.trim();
      if(!text){if(mode==='live'){change('waiting','LIVE VOICE · READY');watch(()=>listen(id),Math.min(3000,600*(++silences)));}else fail('No speech was heard. Tap the microphone to try again.');return;}
      silences=0;change('thinking','ONE MOMENT');
      try{
        const reply=await onTranscript(text);
        if(!current(id))return;
        const resume=ok=>{if(!current(id))return;if(mode==='live'&&ok)watch(()=>listen(id),350);else stop(ok?'':'Voice playback is unavailable. The reply is shown in the chat.');};
        if(reply&&getPreferences().readReplies!==false)speak(reply,id,resume);else resume(true);
      }catch{if(current(id))fail('The voice message could not be completed. Please try again.');}
    };
    try{recognizer.start();}catch{fail('The microphone could not start. Check browser permissions and try again.');}
  }
  function start(next){stop();mode=next;silences=0;listen(epoch);}
  return {
    toggleLive(){if(mode==='live')stop();else start('live');},
    toggleMic(){
      if(mode==='mic'&&recognition){change('finishing','FINISHING');try{watch(()=>fail('Transcription did not finish. Tap the microphone to try again.'),8000);recognition.stop();}catch{stop();}}
      else if(mode==='mic')stop();else start('mic');
    },
    preview(text){stop();mode='preview';speak(text,epoch,ok=>stop(ok?'':'Voice playback is unavailable in this browser.'));},
    stop,
    getState:()=>({mode,phase}),
  };
}
