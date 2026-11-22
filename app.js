'use strict';

const byId = (id) => document.getElementById(id);
const pad = (number) => String(number).padStart(2, '0');
let slides = [];
let sources = {};
let current = 0;

async function getData(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(file);
  return response.json();
}

function selectSource(key, userSelected = false) {
  const source = sources[key];
  document.querySelectorAll('.choose').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.key === key));
  });
  byId('material').textContent = source.location;
  byId('ref-title').textContent = source.title;
  byId('about').textContent = source.about;
  byId('check').textContent = source.check;
  byId('open-source').href = source.url;
  byId('open-source').setAttribute('aria-label', source.title + ' 자료 열기 (새 탭)');
  if (userSelected && matchMedia('(max-width: 820px)').matches) {
    byId('right-label').tabIndex = -1;
    byId('right-label').focus();
    byId('right-label').scrollIntoView({block: 'start'});
  }
}

function makeReference(key) {
  const source = sources[key];
  const row = document.createElement('div');
  row.className = 'ref';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'choose';
  button.dataset.key = key;
  button.setAttribute('aria-controls', 'annotation');
  const title = document.createElement('strong');
  title.textContent = source.title;
  const byline = document.createElement('small');
  byline.textContent = source.by;
  button.append(title, byline);
  button.addEventListener('click', () => selectSource(key, true));
  const link = document.createElement('a');
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = '자료 열기 ↗';
  link.setAttribute('aria-label', source.title + ' 자료 열기 (새 탭)');
  row.append(button, link);
  return row;
}

function render() {
  const found = slides.findIndex((slide) => location.hash === '#slide-' + slide.id);
  current = found < 0 ? 0 : found;
  const slide = slides[current];
  const caption = slide.title + ' · PowerPoint ' + slide.id + '장';
  byId('picker').value = String(slide.id);
  byId('prev').disabled = current === 0;
  byId('next').disabled = current === slides.length - 1;
  byId('counter').textContent = pad(current + 1) + ' / ' + slides.length;
  byId('progress').style.width = ((current + 1) / slides.length * 100) + '%';
  byId('chapter').textContent = slide.chapter;
  byId('deck-id').textContent = 'PPT ' + pad(slide.id);
  byId('slide-img').src = 'slides/' + pad(slide.id) + '.webp';
  byId('slide-img').alt = slide.alt || caption;
  byId('zoom').disabled = false;
  byId('script').textContent = slide.script;
  byId('question').textContent = slide.question;
  byId('refs').replaceChildren(...slide.sources.map(makeReference));
  selectSource(slide.sources[0]);
  byId('announce').textContent = '발표 순서 ' + (current + 1) + '. ' + slide.title;
  document.title = slide.title + ' | 직업교육훈련사 발표 준비실';
}

function go(index) {
  if (index >= 0 && index < slides.length) location.hash = 'slide-' + slides[index].id;
}

function buildPicker() {
  const picker = byId('picker');
  picker.replaceChildren();
  let group;
  slides.forEach((slide, index) => {
    if (!group || group.label !== slide.chapter) {
      group = document.createElement('optgroup');
      group.label = slide.chapter;
      picker.append(group);
    }
    group.append(new Option(pad(index + 1) + ' · ' + slide.title, slide.id));
  });
  picker.disabled = false;
  picker.addEventListener('change', () => { location.hash = 'slide-' + picker.value; });
}

async function init() {
  [slides, sources] = await Promise.all([getData('slides.json'), getData('sources.json')]);
  buildPicker();
  window.addEventListener('hashchange', render);
  byId('prev').addEventListener('click', () => go(current - 1));
  byId('next').addEventListener('click', () => go(current + 1));
  byId('hide-script').addEventListener('click', () => {
    const script = byId('script');
    script.hidden = !script.hidden;
    byId('hide-script').textContent = script.hidden ? '대본 펼치기' : '대본 가리기';
    byId('hide-script').setAttribute('aria-expanded', String(!script.hidden));
  });
  const viewer = byId('viewer');
  byId('zoom').addEventListener('click', () => {
    byId('large-img').src = byId('slide-img').src;
    byId('large-img').alt = byId('slide-img').alt;
    byId('viewer-title').textContent = slides[current].title;
    viewer.showModal();
  });
  byId('close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  document.addEventListener('keydown', (event) => {
    if (viewer.open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.target.closest('select,input,textarea,[contenteditable=true]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      go(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  render();
}
init().catch(() => { byId('error').hidden = false; });
