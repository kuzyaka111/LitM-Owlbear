// Only for replaceable work (window dimensions), never counters or commands.
export function latestTask(run){
 let running=null,next,waiting=false;
 return value=>{next=value;waiting=true;if(!running)running=Promise.resolve().then(async()=>{try{let result;while(waiting){const value=next;waiting=false;result=await run(value);}return result;}finally{running=null;}});return running;};
}
