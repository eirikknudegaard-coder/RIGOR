// Top-layer popovers avoid clipping inside the horizontally scrolling table.
let active=null,pinned=false,hideTimer;
function close(){clearTimeout(hideTimer);if(!active)return;const {button,bubble}=active;if(bubble.hidePopover)bubble.hidePopover();else bubble.hidden=true;button.setAttribute('aria-expanded','false');active=null;pinned=false;}
function open(button){
 clearTimeout(hideTimer);
 if(active?.button===button)return;
 close();const bubble=document.getElementById(button.getAttribute('aria-controls'));active={button,bubble};
 if(bubble.showPopover)bubble.showPopover();else{bubble.removeAttribute('popover');bubble.hidden=false;}
 button.setAttribute('aria-expanded','true');
 const bounds=button.getBoundingClientRect(),box=bubble.getBoundingClientRect();
 bubble.style.left=Math.max(12,Math.min(bounds.left,innerWidth-box.width-12))+'px';
 bubble.style.top=(bounds.bottom+8+box.height<=innerHeight-12?bounds.bottom+8:Math.max(12,bounds.top-box.height-8))+'px';
}
function leave(){clearTimeout(hideTimer);if(!pinned)hideTimer=setTimeout(()=>{if(!pinned&&document.activeElement!==active?.button)close();},120);}
for(const button of document.querySelectorAll('.column-help-button')){
 const bubble=document.getElementById(button.getAttribute('aria-controls'));
 if(!bubble.showPopover){bubble.removeAttribute('popover');bubble.hidden=true;}
 button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')open(button);});
 button.addEventListener('pointerleave',leave);
 button.addEventListener('focus',()=>open(button));
 button.addEventListener('blur',leave);
 button.addEventListener('click',()=>{if(active?.button===button&&pinned)close();else{open(button);pinned=true;}});
 bubble.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
 bubble.addEventListener('pointerleave',leave);
}
document.addEventListener('pointerdown',event=>{if(active&&!active.button.contains(event.target)&&!active.bubble.contains(event.target))close();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){close();event.preventDefault();}});
window.addEventListener('resize',close);
document.addEventListener('scroll',event=>{if(active&&!active.bubble.contains(event.target))close();},true);
// Close help when its table is hidden by a view switch.
for(const button of document.querySelectorAll('#simple,#detailed'))button.addEventListener('click',close);
