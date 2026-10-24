// Short synthesized impacts, triggered only by physical contact forces.
export function createDiceSound(win){
 const Audio=win.AudioContext||win.webkitAudioContext;
 let context,buffer;const voices=new Set();let last=-Infinity;
 try{
  if(Audio){context=new Audio();void context.resume().catch(()=>{});
   buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.065),context.sampleRate);
   const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(context.sampleRate*.014));
  }
 }catch{context?.close().catch(()=>{});context=null;}
 return {impact(force){
  if(!context||context.state!=='running'||force<45)return;
  const now=context.currentTime;if(now-last<.035||voices.size>=6)return;last=now;
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=buffer;source.playbackRate.value=.8+Math.random()*.4;
  filter.type='bandpass';filter.frequency.value=700+Math.min(force,600)*2;filter.Q.value=.65;
  gain.gain.setValueAtTime(Math.min(.38,force/1800),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.075);
  source.connect(filter);filter.connect(gain);gain.connect(context.destination);voices.add(source);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();voices.delete(source);};source.start(now);source.stop(now+.08);
 },dispose(){if(!context)return;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();void context.close().catch(()=>{});context=null;}};
}
