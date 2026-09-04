import { HOTBAR, BLOCKS } from "./blocks.js";

export function setupHotbar(){
  const bar=document.getElementById("hotbar");
  let selected=0;
  function draw(){
    bar.innerHTML="";
    HOTBAR.forEach((type,i)=>{
      const slot=document.createElement("div");
      slot.className="slot"+(i===selected?" selected":"");
      const sw=document.createElement("div"); sw.className="swatch";
      sw.style.background=`#${BLOCKS[type].color.toString(16).padStart(6,"0")}`;
      const label=document.createElement("span"); label.textContent=`${i+1} ${BLOCKS[type].name}`;
      slot.append(sw,label); bar.appendChild(slot);
    });
  }
  window.addEventListener("keydown",e=>{
    const n=Number(e.key);
    if(n>=1&&n<=HOTBAR.length){selected=n-1;draw()}
  });
  draw();
  return ()=>HOTBAR[selected];
}
