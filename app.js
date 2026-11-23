'use strict';
const byId = (id) => document.getElementById(id);
const pad = (number) => String(number).padStart(2, '0');
let credits = [];
let slides = [], sources = {}, current = 0, activeView = '', activeKey = '';
const used = new Map();
const localFiles = new Map();
const localUrls = new Map();
const motionScenes = {
  10: {base:'map-au-schools', alt:'호바트와 시드니의 노동자 교육기관 설립 위치와 연도'},
  21: {base:'atlas', alt:'자동차 부품을 집어 옮기고 삽입하는 작업을 나타낸 설명용 도식'}
};

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(text, href, external = false) {
  const a = node('a', text);
  a.href = href;
  if (external) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}
function slideUrl(id, key) {
  return '#slide-' + id + (key ? '/ref-' + encodeURIComponent(key) : '');
}
function refUrl(key) { return '#source-' + encodeURIComponent(key); }
async function getData(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(file);
  return response.json();
}
function sourceType(s) { return s.type || s.location?.split(' · ')[0] || '기타'; }
function citation(s) { return s.apa || [s.by, s.originalTitle || s.title].filter(Boolean).join('. '); }
function locationHint(s) { return s.location || s.pageLabel || ''; }

function combineHoldings() {
  for (const h of heldOriginals) {
    const key = sources[h.match] ? h.match : Object.keys(sources).find(k =>
      sources[k].filename === h.file ||
      (sources[k].originalTitle && sources[k].originalTitle.toLowerCase() === h.title.toLowerCase()));
    if (key) {
      sources[key].holding = h;
    } else {
      sources[h.key] = {...h, holding:h, originalTitle:h.title,
        access:h.url ? '보유 PDF · 발행처/서지 링크' : '보유 PDF'};
    }
  }
  slides.forEach(slide => slide.sources.forEach(key => {
    if (!sources[key]) throw new Error('Missing source ' + key);
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(slide);
  }));
}
function openLinks(key, allowLocalSetup = true) {
  const s = sources[key], container = node('div', '', 'source-actions');
  if (s.url) container.append(link(s.holding && !used.has(key) ? '발행처·자료 ↗' : '자료 열기 ↗', s.url, true));
  if (s.doi) {
    const doiUrl = s.doi.startsWith('http') ? s.doi : 'https://doi.org/' + s.doi;
    if (s.url !== doiUrl) container.append(link('DOI ↗', doiUrl, true));
  }
  if (s.holding) {
    const h = s.holding, normalized = h.file.normalize('NFC');
    if (localFiles.has(normalized)) {
      if (!localUrls.has(normalized)) localUrls.set(normalized, URL.createObjectURL(localFiles.get(normalized)));
      container.append(link('보유 PDF 열기 ↗', localUrls.get(normalized) + '#page=' + h.page, true));
    } else if (allowLocalSetup) {
      const button = node('button','보유 PDF 연결','text-button');
      button.type = 'button';
      button.addEventListener('click', () => {
        if (activeView !== 'bib') location.hash = 'bibliography';
        requestAnimationFrame(() => {
          document.querySelector('.local-access').open = true;
          byId('files').focus();
          byId('files').scrollIntoView({block:'center'});
        });
      });
      container.append(button);
    }
  }
  return container;
}

function selectSource(key, userSelected = false) {
  activeKey = key;
  const s = sources[key];
  document.querySelectorAll('.choose').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.key === key)));
  byId('material').textContent = locationHint(s);
  byId('ref-title').textContent = s.title;
  byId('about').textContent = s.about;
  byId('check').textContent = s.check;
  const claim = slides[current].claims?.[key] || '';
  byId('claim').textContent = claim;
  byId('claim').hidden = !claim;
  const links = openLinks(key);
  links.append(link('전체 서지정보 →',refUrl(key)));
  byId('annotation-links').replaceChildren(links);
  if (userSelected && matchMedia('(max-width:820px)').matches) {
    byId('right-label').focus();
    byId('right-label').scrollIntoView({block:'start'});
  }
}
function makeReference(key) {
  const s = sources[key], row = node('div','','ref'), button = node('button','','choose');
  button.type = 'button';
  button.dataset.key = key;
  button.setAttribute('aria-controls','annotation');
  button.append(node('strong',s.title),node('small',s.by));
  button.addEventListener('click', () => {
    history.replaceState(null,'',slideUrl(slides[current].id,key));
    selectSource(key,true);
  });
  row.append(button);
  if (s.url) row.append(link('자료 열기 ↗',s.url,true));
  return row;
}
function updateAnimation(playing = false) {
  const id = slides[current].id, scene = motionScenes[id];
  byId('animation').hidden = !scene;
  byId('atlas-player').replaceChildren();
  byId('atlas-player').hidden = true;
  byId('watch').textContent = 'Atlas 실영상 재생';
  byId('watch').setAttribute('aria-expanded', 'false');
  byId('watch').hidden = id !== 21;
  if (!scene) { byId('animation-frame').removeAttribute('src'); return; }
  byId('animation-frame').src = 'media/' + scene.base + (playing ? '.gif' : '-poster.png');
  byId('animation-frame').alt = scene.alt;
  byId('motion').setAttribute('aria-pressed',String(playing));
  byId('motion').textContent = playing ? '정지 화면' : '도식 재생';
  byId('atlas-video').hidden = id !== 21;
}
const visualKeys = {
  'de-draw':'de-class.jpg', 'de-shop':'de-shop.jpg','au-photo':'au-class.jpg','us-photo':'us-class.jpg',
  'bremen':'bremen.png','ulmer':'ulmer.png','goozee':'goozee.png','bowman':'bowman.png','smith':'smith.png',
  'linkow':'linkow.png','us-contract':'us-contract.jpg','budj-photo':'budj.jpg','de1897-scan':'de1897.png',
  'morrill':'morrill.png','tafe-course':'tafe-course.png','atlas':'atlas.gif'
};
function showVisuals(slide) {
  const files = new Set(slide.sources.map(key => visualKeys[key]).filter(Boolean));
  if (slide.sources.includes('map-base')) {
    const region = slide.chapter.includes('독일') ? 'de' : slide.chapter.includes('호주') ? 'au' : 'us';
    files.add('map-' + region + '.png');
  }
  if (slide.id === 10) files.add('map-au-schools.gif');
  const rows = credits.filter(item => files.has(item.filename.split('/').pop())).map(item => {
    const fig = node('figure'), caption = node('figcaption');
    const photo = node('img');
    photo.src = item.filename.replace(/\.gif$/,'-poster.png');
    photo.alt = item.description;
    photo.loading = 'lazy';
    const full = link('',item.filename,true);
    full.setAttribute('aria-label',item.description+' 크게 열기');
    full.append(photo);
    caption.append(node('strong',item.source),node('small',item.description),node('small',item.credit));
    const links = node('div','','source-actions');
    links.append(link(item.role+' 파일 ↗',item.filename,true));
    if (item.url) links.append(link('소장처·출처 ↗',item.url,true));
    caption.append(links);fig.append(full,caption);return fig;
  });
  byId('visuals').replaceChildren(...rows);
  byId('visual-register').hidden=!rows.length;
  byId('visual-register').open=false;
}
function renderSlide(id, sourceKey) {
  const found = slides.findIndex(slide => slide.id === id);
  current = found < 0 ? 0 : found;
  const slide = slides[current];
  byId('picker').value = String(slide.id);
  byId('prev').disabled = current === 0;
  byId('next').disabled = current === slides.length - 1;
  byId('counter').textContent = pad(current+1) + ' / ' + slides.length;
  byId('progress').style.width = ((current+1)/slides.length*100) + '%';
  byId('chapter').textContent = slide.chapter;
  byId('deck-id').textContent = 'PPT ' + pad(slide.id);
  byId('slide-img').src = 'slides/' + pad(slide.id) + '.webp';
  byId('slide-img').alt = slide.alt || slide.title;
  byId('zoom').disabled = false;
  byId('script').textContent = slide.script;
  byId('question').textContent = slide.question;
  byId('refs').replaceChildren(...slide.sources.map(makeReference));
  selectSource(slide.sources.includes(sourceKey) ? sourceKey : slide.sources[0]);
  updateAnimation();
  showVisuals(slide);
  byId('nav-slides').href = slideUrl(slide.id,activeKey);
  byId('announce').textContent = '발표 순서 ' + (current+1) + '. ' + slide.title;
  document.title = slide.title + ' | 직업교육훈련사 발표 준비실';
}
function setFilterOptions(id, values) {
  const select = byId(id);
  select.replaceChildren(new Option('전체',''));
  [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b,'ko'))
    .forEach(v => select.add(new Option(v,v)));
}
function metadataRow(list, title, text) {
  if (text) list.append(node('dt', title),node('dd', text));
}
function makeRecord(key) {
  const s = sources[key], row = node('details','','record');
  row.id = 'record-' + key;
  const summary = node('summary'), heading = node('span','','record-heading');
  heading.append(node('strong',s.title),node('small',[s.by,s.country,sourceType(s)].filter(Boolean).join(' · ')));
  summary.append(heading);
  if (s.holding) summary.append(node('span','보유 PDF','held-flag'));
  const detail = node('div','','record-detail');
  detail.append(node('p',citation(s),'citation'));
  const dl = node('dl','','source-data');
  if (s.originalTitle && s.originalTitle !== s.title) metadataRow(dl,'원제',s.originalTitle);
  metadataRow(dl,'자료 위치',locationHint(s));
  metadataRow(dl,'읽을 대목',s.check);
  metadataRow(dl,'접근 경로',[s.access || '발행처 자료',s.holding && !String(s.access).includes('보유') ? '보유 PDF' : ''].filter(Boolean).join(' · '));
  if (s.holding) metadataRow(dl,'보유 파일명',s.holding.file);
  const use = used.get(key) || [];
  const wrap = node('div','','used-slides');
  wrap.append(node('strong',use.length ? '사용 장표' : '발표 준비용 추가 문헌'));
  use.forEach(slide => {
    const a = link(pad(slide.id) + '장',slideUrl(slide.id,key));
    a.title = slide.title;
    a.setAttribute('aria-label',pad(slide.id)+'장 '+slide.title);
    wrap.append(a);
  });
  detail.append(dl,wrap,openLinks(key));
  row.append(summary,detail);
  return row;
}
function renderRecords() {
  const q = byId('query').value.trim().toLocaleLowerCase();
  const searched = Object.entries(sources).filter(([key,s]) => {
    if (byId('collection').value === 'used' && !used.has(key)) return false;
    if (byId('collection').value === 'holding' && !s.holding) return false;
    if (byId('country').value && s.country !== byId('country').value) return false;
    if (byId('kind').value && sourceType(s) !== byId('kind').value) return false;
    if (byId('era').value && s.era !== byId('era').value) return false;
    return !q || [s.title,s.originalTitle,s.by,s.author,s.apa,s.holding?.apa,s.holding?.file,s.location,s.check]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(q);
  });
  searched.sort((a,b) => (a[1].author || a[1].by || '').localeCompare(b[1].author || b[1].by || '','ko'));
  byId('result-count').textContent = searched.length + '건 / 전체 ' + Object.keys(sources).length + '건 · 보유 원문 ' + heldOriginals.length + '편';
  byId('records').replaceChildren(...searched.map(([key]) => makeRecord(key)));
  if (!searched.length) byId('records').append(node('p','검색 결과가 없습니다. 검색어를 줄이거나 필터를 초기화하세요.','empty'));
}
function clearFilters() {
  ['query','country','kind','era','collection'].forEach(key => { byId(key).value=''; });
}
function connectFiles(event) {
  const originals = new Set(heldOriginals.map(h => h.file.normalize('NFC')));
  let matched = 0;
  for (const f of event.target.files) {
    const name = f.name.normalize('NFC');
    if (!originals.has(name)) continue;
    if (localUrls.has(name)) URL.revokeObjectURL(localUrls.get(name));
    localUrls.delete(name);
    localFiles.set(name,f); matched++;
  }
  byId('file-status').textContent = matched ? '연결된 보유 원문 ' + localFiles.size + ' / ' + heldOriginals.length + '편' : '목록과 파일명이 일치하는 PDF가 없습니다.';
  const open = [...document.querySelectorAll('.record[open]')].map(e=>e.id);
  renderRecords();
  open.forEach(id=>{if(byId(id))byId(id).open=true;});
  event.target.value='';
}
function studyPlan() {
  const plans = [
    ['독일',[[4,'수공업 견습의 배경'],[6,'기업 견습학교의 사진'],[7,'기업과 학교의 훈련기준'],[22,'산업 직종의 디지털 기준']]],
    ['호주',[[9,'부지 빔의 생업 기술'],[10,'식민지 교육기관과 제화학교'],[11,'캉간 보고서와 TAFE'],[13,'이수 기록의 상호인정'],[22,'TAFE의 원격운영 과정']]],
    ['미국',[[15,'견습계약의 교육 조건'],[16,'토지 지원과 남부 교육기관'],[17,'터스키기의 제도 수업'],[18,'연방 보조금 지급 조건'],[23,'AI 지침과 기업 도제과정']]],
    ['한국·비교',[[2,'숙련 형성의 비교 관점'],[3,'동시대 전환점'],[20,'전후 훈련정책 비교'],[24,'한국에 적용할 질문']]]
  ];
  const groups=plans.map(([country,steps])=>{
    const section=node('section','','study-group');
    section.append(node('h2',country));
    const ol=node('ol');
    for (const [id,title] of steps) {
      const s=slides.find(x=>x.id===id);
      if (!s) continue;
      const li=node('li'), header=node('div','','study-item');
      const items=s.sources.filter(k=>id!==22 || sources[k].country===country);
      header.append(node('strong',title),link(pad(id)+'장 보기 →',slideUrl(id)));
      const refs=node('ul');
      items.forEach(key=>{
        const source=sources[key], item=node('li');
        item.append(link(source.title,refUrl(key)),node('small',source.check || source.location));
        refs.append(item);
      });
      li.append(header,refs);ol.append(li);
    }
    section.append(ol);return section;
  });
  byId('study-list').replaceChildren(...groups);
}
function route(first = false) {
  const hash = location.hash;
  const view = hash==='#reading'?'study':hash==='#bibliography'||hash.startsWith('#source-')?'bib':'slide';
  const changed = view!==activeView;
  activeView=view;
  for(const v of ['slide','bib','study']){
    byId(v+'-view').hidden=v!==view;
    if(v==='slide' && v!==view){byId('atlas-player').replaceChildren();byId('atlas-player').hidden=true;byId('animation-frame').removeAttribute('src');}
    const anchor=byId('nav-'+(v==='slide'?'slides':v));
    if(v===view)anchor.setAttribute('aria-current','page'); else anchor.removeAttribute('aria-current');
  }
  if (view==='slide') {
    const m=/^#slide-(\d+)(?:\/ref-([\w-]+))?$/.exec(hash);
    renderSlide(m ? Number(m[1]) : slides[0].id,m?.[2]);
  } else if (view==='bib') {
    const key=hash.startsWith('#source-')?hash.slice(8):'';
    if(key && sources[key])clearFilters();
    renderRecords();
    document.title='전체 참고문헌 | 직업교육훈련사';
    if(key && byId('record-'+key)){
      const row=byId('record-'+key);
      row.open=true;
      requestAnimationFrame(()=>{row.querySelector('summary').focus({preventScroll:true});row.scrollIntoView({block:'start'});});
      return;
    }
  } else {
    document.title='문헌 읽기 순서 | 직업교육훈련사';
    studyPlan();
  }
  if (!first && changed) {
    byId('content').focus({preventScroll:true});
    window.scrollTo(0,0);
  }
}
function go(idx) { if(idx>=0&&idx<slides.length)location.hash=slideUrl(slides[idx].id); }

async function init() {
  [slides,sources,credits]=await Promise.all([getData('slides.json'),getData('sources.json'),getData('media/credits.json')]);
  combineHoldings();
  const picker=byId('picker'); picker.replaceChildren();
  let group;
  slides.forEach((s,i)=>{
    if(!group || group.label!==s.chapter){group=node('optgroup');group.label=s.chapter;picker.append(group);}
    group.append(new Option(pad(i+1)+' · '+s.title,s.id));
  });
  picker.disabled=false;
  picker.addEventListener('change',()=>{location.hash=slideUrl(picker.value);});
  window.addEventListener('hashchange',()=>route());
  byId('prev').addEventListener('click',()=>go(current-1));
  byId('next').addEventListener('click',()=>go(current+1));
  byId('motion').addEventListener('click',()=>updateAnimation(byId('motion').getAttribute('aria-pressed')!=='true'));
  byId('hide-script').addEventListener('click',()=>{
    const script=byId('script');script.hidden=!script.hidden;
    byId('hide-script').textContent=script.hidden?'대본 펼치기':'대본 가리기';
    byId('hide-script').setAttribute('aria-expanded',String(!script.hidden));
  });
  byId('watch').addEventListener('click',()=>{
    const holder=byId('atlas-player'), wasHidden=holder.hidden;
    holder.replaceChildren();
    if(wasHidden){
      const frame=node('iframe');
      frame.src='https://www.youtube-nocookie.com/embed/F_7IPm7f1vI';
      frame.title='Boston Dynamics · Atlas Goes Hands On';
      frame.allowFullscreen=true;
      frame.referrerPolicy='strict-origin-when-cross-origin';
      holder.append(frame);
    }
    holder.hidden=!wasHidden;
    byId('watch').textContent=wasHidden?'실영상 닫기':'Atlas 실영상 재생';
    byId('watch').setAttribute('aria-expanded',String(wasHidden));
  });
  const all=Object.values(sources);
  setFilterOptions('country',all.map(s=>s.country));setFilterOptions('era',all.map(s=>s.era));setFilterOptions('kind',all.map(sourceType));
  ['country','era','kind','collection'].forEach(id=>byId(id).addEventListener('change',renderRecords));
  byId('query').addEventListener('input',renderRecords);
  byId('clear').addEventListener('click',()=>{clearFilters();renderRecords();});
  ['files','folder'].forEach(id=>byId(id).addEventListener('change',connectFiles));
  const viewer=byId('viewer');
  byId('zoom').addEventListener('click',()=>{
    byId('large-img').src=byId('slide-img').src;
    byId('large-img').alt=byId('slide-img').alt;
    byId('viewer-title').textContent=slides[current].title;viewer.showModal();
  });
  byId('close').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
  document.addEventListener('keydown',e=>{
    if(activeView!=='slide'||viewer.open||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('select,input,textarea,[contenteditable=true]'))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();go(current+(e.key==='ArrowLeft'?-1:1));}
  });
  route(true);
}
init().catch(error=>{console.error(error);byId('error').hidden=false;});
