'use strict';
const jump=document.getElementById('jump'),current=document.getElementById('currentSlide'),btn=document.getElementById('toggleStudy'),sections=[...document.querySelectorAll('.slide-entry')],studies=[...document.querySelectorAll('details.study')];
function normalizeHash(){const m=location.hash.match(/^#slide=(\d{1,2})$/);if(m){const n=Number(m[1]);if(n>=1&&n<=39){const id='slide-'+String(n).padStart(2,'0');history.replaceState(null,'','#'+id);document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'});jump.value=id;}}}
jump.addEventListener('change',()=>{if(jump.value)location.hash=jump.value;});
btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-pressed')!=='true';studies.forEach(x=>x.open=open);btn.setAttribute('aria-pressed',String(open));btn.textContent=open?'해설 접기':'해설 펼치기';});
let pending=false;
function sync(){const threshold=Math.max(document.querySelector('.toolbar').getBoundingClientRect().bottom+32,(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0)+(parseFloat(getComputedStyle(sections[0]).scrollMarginTop)||0)+10);let active=sections[0];for(const s of sections){if(s.getBoundingClientRect().top<=threshold)active=s;else break;}const n=active.dataset.slide;current.textContent=n+' / 39';jump.value=active.id;pending=false;}
function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('hashchange',()=>{normalizeHash();schedule();});
normalizeHash();schedule();