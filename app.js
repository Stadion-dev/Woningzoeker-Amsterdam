const areas = [
  { id: 'west', name: 'Amsterdam-West', label: 'WEST', title: 'Leven rond het Erasmuspark', description: 'Van de koffiezaken in De Baarsjes tot het groen van het Erasmuspark. In West is alles dichtbij.', detail: 'Rond het Erasmuspark vind je rustige woonstraten, terwijl de Jan Evertsenstraat winkels en horeca op loopafstand biedt.' },
  { id: 'zuid', name: 'Amsterdam-Zuid', label: 'ZUID', title: 'Op loopafstand van het Vondelpark', description: 'Statige gevels, groene lanen en het Vondelpark als verlengstuk van je achtertuin.', detail: 'In de straten rond het Vondelpark wisselen klassieke bovenwoningen en ruime appartementen elkaar af. De Cornelis Schuytstraat biedt winkels en cafés.' },
  { id: 'rivierenbuurt', name: 'Rivierenbuurt', label: 'RIVIERENBUURT', title: 'Amsterdamse School aan de Amstel', description: 'Karakteristieke baksteen, brede straten en een rondje langs de Amstel om de hoek.', detail: 'De Rivierenbuurt is herkenbaar aan de architectuur van de Amsterdamse School. Rond de Maasstraat liggen buurtwinkels en aan de Amstel kun je langs het water wandelen.' }
];
const examples = [
  { id: 'voorbeeld-west', area: 'west', price: 485000, size: 66 },
  { id: 'voorbeeld-zuid', area: 'zuid', price: 675000, size: 82 },
  { id: 'voorbeeld-rivierenbuurt', area: 'rivierenbuurt', price: 555000, size: 74 }
];
const money = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
const main = document.querySelector('#main');
const homeTypes = {
  appartement: 'Appartement',
  woonhuis: 'Woonhuis',
  studio: 'Studio',
  maisonnette: 'Maisonnette',
  overig: 'Overig'
};
const sortOptions = {
  standaard: 'Standaardvolgorde',
  recent: 'Nieuwste eerst',
  prijslaag: 'Laagste vraagprijs eerst',
  prijshoog: 'Hoogste vraagprijs eerst',
  oppervlakte: 'Grootste woonoppervlakte eerst',
  vierkantemeter: 'Laagste vraagprijs per m² eerst'
};
const defaults = {
  areas: areas.map(area => area.id), max: '', minSize: '', postcodes: [], types: [], sort: 'standaard'
};
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
let preferences = { ...defaults, ...read('woningzoeker-preferences', defaults) };
let favorites = new Set(read('woningzoeker-favorites', []));
let activeFilter = 'all';
let data = { homes: [], benchmark: null };
let feedFailed = false;
let feedLoading = true;

function escape(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function heart(id, title) {
  const selected = favorites.has(id);
  return `<button class="heart" type="button" data-favorite="${escape(id)}" aria-label="${selected ? 'Verwijder uit favorieten' : 'Bewaar als favoriet'}: ${escape(title)}" aria-pressed="${selected}">${selected ? '♥' : '♡'}</button>`;
}
function photo(area) {
  return `<div class="photo photo-${area.id}" role="img" aria-label="Impressie van ${area.name}"></div>`;
}
function card(area) {
  return `<article class="card"><div class="card-media">${photo(area)}<span class="tag">${area.label}</span>${heart(area.id, area.name)}</div>
  <div class="card-body"><h3><a href="#buurt/${area.id}">${area.name}</a></h3><p class="card-title">${area.title}</p><p>${area.description}</p><a class="text-link" href="#buurt/${area.id}">Ontdek de buurt <span aria-hidden="true">↗</span></a></div></article>`;
}
function homeLocation(home) {
  return [areas.find(area => area.id === home.area).name, home.postcode, homeTypes[home.type]]
    .filter(Boolean).map(escape).join(' · ');
}
function listHomes(homes) {
  return `<div class="home-list">${homes.map(home => `<article class="home-row"><div><h3><a href="#woning/${encodeURIComponent(home.id)}">${escape(home.title)}</a></h3><p>${homeLocation(home)} · ${money.format(home.price)} · ${number.format(home.size)} m²</p></div>${heart(home.id, home.title)}</article>`).join('')}</div>`;
}
function matches(home) {
  return preferences.areas.includes(home.area) && (activeFilter === 'all' || activeFilter === home.area) &&
    (!preferences.postcodes.length || preferences.postcodes.includes(home.postcode?.slice(0, 4))) &&
    (!preferences.types.length || preferences.types.includes(home.type)) &&
    (!preferences.max || home.price <= preferences.max) && (!preferences.minSize || home.size >= preferences.minSize);
}
function publicationTime(home) {
  const timestamp = Date.parse(home.publishedAt);
  return Number.isFinite(timestamp) ? timestamp : -Infinity;
}
const comparators = {
  recent: (a, b) => publicationTime(b) - publicationTime(a),
  prijslaag: (a, b) => a.price - b.price,
  prijshoog: (a, b) => b.price - a.price,
  oppervlakte: (a, b) => b.size - a.size,
  vierkantemeter: (a, b) => a.price / a.size - b.price / b.size
};
function overview() {
  const visible = areas.filter(area => preferences.areas.includes(area.id) && (activeFilter === 'all' || activeFilter === area.id));
  const homes = data.homes.filter(matches);
  if (Object.hasOwn(comparators, preferences.sort)) homes.sort(comparators[preferences.sort]);
  return `<section class="hero"><div class="hero-content"><div class="eyebrow"><span></span> WONEN IN AMSTERDAM</div><h1>Vind jouw plek<br>in <em>Amsterdam.</em></h1><p>Ontdek Amsterdam-West, Zuid en de Rivierenbuurt. Verken de buurten, bekijk wat een woning kost en bewaar je favorieten.</p><a class="primary" href="#overzicht/buurten">Ontdek de buurten <span aria-hidden="true">↓</span></a></div><div class="hero-image" role="img" aria-label="Impressie van Amsterdamse woningen"></div></section>
  <section class="section" id="buurten"><div class="section-heading"><div><span class="eyebrow">DE BUURTGIDS</span><h2>Buurtpareltjes</h2></div><div class="filters" aria-label="Filter op buurt">${[{id:'all',name:'Alle buurten'}, ...areas.filter(area => preferences.areas.includes(area.id))].map(area => `<button type="button" data-area="${area.id}" aria-pressed="${activeFilter === area.id}">${area.name}</button>`).join('')}</div></div>
  <div class="grid">${visible.map(card).join('')}</div></section>
  <section class="section listings"><div class="section-heading"><h2>Woningen</h2><a class="text-link" href="#instellingen">Zoekvoorkeuren ↗</a></div>
  ${homes.length ? listHomes(homes) : `<p class="notice">${feedLoading ? 'Aanbod laden…' : feedFailed ? 'Het woningaanbod is nu niet bereikbaar.' : data.source ? 'Geen woningen gevonden voor je zoekvoorkeuren.' : 'Er is nog geen toegestane aanbieder gekoppeld. Je vindt een voorbeeld van de prijsanalyse op elke buurtpagina.'}</p>`}
  ${data.source ? `<p class="source">Aanbodbron: ${escape(data.source)} · gecontroleerd op ${new Date(data.updatedAt).toLocaleDateString('nl-NL', {timeZone:'Europe/Amsterdam'})}</p>` : ''}</section>`;
}
function settings() {
  return `<section class="section inner"><span class="eyebrow">JOUW ZOEKOPDRACHT</span><h1>Instellingen</h1><p>Stel in welke woningen je wilt zien en kies de volgorde van het aanbod.</p>
  <form id="settings" class="panel"><fieldset><legend>Buurten</legend>${areas.map(area => `<label class="check"><input type="checkbox" name="area" value="${area.id}" ${preferences.areas.includes(area.id) ? 'checked' : ''}> ${area.name}</label>`).join('')}</fieldset>
  <div class="field"><label for="postcodes">Postcodegebieden</label><input id="postcodes" name="postcodes" type="text" inputmode="text" aria-describedby="postcode-help" value="${escape(preferences.postcodes.join(', '))}" placeholder="Bijv. 1056, 1078"><small id="postcode-help">Vul vier cijfers per gebied in, gescheiden door een komma of spatie. Leeg geldt voor alle postcodes binnen je gekozen buurten.</small></div>
  <fieldset><legend>Woningtype</legend><p class="field-help">Laat alle vakjes leeg om alle woningtypen te zien.</p>${Object.entries(homeTypes).map(([id, label]) => `<label class="check"><input type="checkbox" name="type" value="${id}" ${preferences.types.includes(id) ? 'checked' : ''}> ${label}</label>`).join('')}</fieldset>
  <label class="field">Maximale vraagprijs (€)<input name="max" type="number" min="1" step="1" value="${escape(preferences.max)}" placeholder="Geen maximum"></label>
  <label class="field">Minimale woonoppervlakte (m²)<input name="minSize" type="number" min="1" step="1" value="${escape(preferences.minSize)}" placeholder="Geen minimum"></label>
  <label class="field">Sortering<select name="sort">${Object.entries(sortOptions).map(([id, label]) => `<option value="${id}" ${preferences.sort === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
  <button class="primary">Instellingen opslaan</button><p id="form-status" role="status"></p></form></section>`;
}
function favoritePage() {
  const savedAreas = areas.filter(area => favorites.has(area.id));
  const savedHomes = data.homes.filter(home => favorites.has(home.id));
  const missing = [...favorites].filter(id => !areas.some(area => area.id === id) && !savedHomes.some(home => home.id === id));
  return `<section class="section"><span class="eyebrow">JOUW SELECTIE</span><h1>Favorieten</h1>
  ${favorites.size ? `<div class="grid">${savedAreas.map(card).join('')}</div>${listHomes(savedHomes)}${missing.map(id => `<article class="home-row"><p>Deze bewaarde woning is momenteel niet beschikbaar.</p>${heart(id, 'Woning')}</article>`).join('')}` : '<p class="notice">Je hebt nog geen favorieten. Tik op het hartje om een buurt of woning te bewaren.</p>'}
  <a class="text-link" href="#overzicht">Naar het overzicht ↗</a></section>`;
}
function analysis(home, example) {
  if (!home) return '';
  const benchmark = data.benchmark;
  const unitPrice = home.price / home.size;
  return `<section class="panel"><h2>Prijsanalyse</h2>${example ? '<p class="notice">Rekenvoorbeeld met fictieve woninggegevens.</p>' : ''}
  <dl class="metrics"><div><dt>Vraagprijs</dt><dd>${money.format(home.price)}</dd></div><div><dt>Woonoppervlakte</dt><dd>${number.format(home.size)} m²</dd></div><div><dt>Vraagprijs per m²</dt><dd>${money.format(unitPrice)}</dd></div></dl>
  <p>De vierkantemeterprijs is de vraagprijs gedeeld door de woonoppervlakte.</p>
${benchmark ? `<p>CBS rapporteert voor ${escape(benchmark.period)} een gemiddelde verkoopprijs van ${money.format(benchmark.price)} voor bestaande koopwoningen in de gemeente Amsterdam. Het cijfer omvat verschillende woningtypen en oppervlaktes en dient als stadsbrede context.</p><a class="text-link" href="${escape(benchmark.url)}" rel="noopener">CBS StatLine ↗</a>` : ''}</section>`;
}
function detail(area, home) {
  const title = home ? home.title : area.name;
  return `<section class="section detail"><a class="text-link" href="#overzicht">← Terug naar overzicht</a>
  <div class="detail-photo">${photo(area)}${heart(home ? home.id : area.id, title)}</div>
  <span class="eyebrow">${area.label}</span><h1>${escape(title)}</h1>${home ? `<p>${homeLocation(home)}</p>` : ''}<p>${home ? escape(home.description || '') : area.detail}</p>
  ${home ? `<a class="text-link" href="${escape(home.url)}" rel="noopener">Bekijk bij de aanbieder ↗</a>` : ''}
  ${analysis(home || examples.find(example => example.area === area.id), !home)}</section>`;
}
function render() {
  const [page, id] = (location.hash.slice(1) || 'overzicht').split('/');
  const area = areas.find(area => area.id === id);
  const home = data.homes.find(home => encodeURIComponent(home.id) === id);
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === page || (link.dataset.nav === 'overzicht' && ['buurt','woning'].includes(page))) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (page === 'instellingen') main.innerHTML = settings();
  else if (page === 'favorieten') main.innerHTML = favoritePage();
  else if (page === 'buurt' && area) main.innerHTML = detail(area);
  else if (page === 'woning' && home) main.innerHTML = detail(areas.find(area => area.id === home.area), home);
  else if (page === 'woning' || page === 'buurt') main.innerHTML = `<section class="section"><h1>${feedLoading && page === 'woning' ? 'Woning laden…' : 'Pagina niet beschikbaar'}</h1><a class="text-link" href="#overzicht">Naar overzicht ↗</a></section>`;
  else main.innerHTML = overview();
}
main.addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]');
  const filter = event.target.closest('[data-area]');
  if (favorite) {
    const id = favorite.dataset.favorite;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    const stored = save('woningzoeker-favorites', [...favorites]);
    render();
    const updated = [...main.querySelectorAll('[data-favorite]')].find(button => button.dataset.favorite === id);
    updated?.focus({ preventScroll: true });
    if (!stored) {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Favorieten blijven alleen beschikbaar zolang deze pagina open is.';
      main.prepend(message);
    }
  }
  if (filter) {
    activeFilter = filter.dataset.area;
    render();
    main.querySelector(`[data-area="${activeFilter}"]`)?.focus({ preventScroll: true });
  }
});
main.addEventListener('submit', event => {
  if (event.target.id !== 'settings') return;
  event.preventDefault();
  const form = new FormData(event.target);
  const selected = form.getAll('area');
  const status = document.querySelector('#form-status');
  if (!selected.length) {
    status.textContent = 'Kies minstens één buurt.';
    return;
  }
  const postcodeInput = event.target.elements.postcodes;
  const postcodes = [...new Set(postcodeInput.value.split(/[\s,]+/).filter(Boolean))];
  if (postcodes.some(code => !/^[1-9][0-9]{3}$/.test(code))) {
    postcodeInput.setAttribute('aria-invalid', 'true');
    status.textContent = 'Gebruik vier cijfers per postcodegebied, bijvoorbeeld 1056.';
    postcodeInput.focus();
    return;
  }
  postcodeInput.removeAttribute('aria-invalid');
  postcodeInput.value = postcodes.join(', ');
  preferences = {
    areas: selected, max: form.get('max'), minSize: form.get('minSize'),
    postcodes, types: form.getAll('type'), sort: form.get('sort')
  };
  if (!selected.includes(activeFilter)) activeFilter = 'all';
  status.textContent = save('woningzoeker-preferences', preferences) ? 'Instellingen opgeslagen.' : 'Instellingen zijn alleen actief zolang deze pagina open is.';
});
function navigate() {
  render();
  if (location.hash === '#overzicht/buurten') document.querySelector('#buurten')?.scrollIntoView();
  else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);
navigate();
fetch('./data/aanbod.json').then(response => {
  if (!response.ok) throw new Error('Aanbod niet beschikbaar');
  return response.json();
}).then(result => { data = result; }).catch(() => { feedFailed = true; }).finally(() => {
  feedLoading = false;
  // Preserve unsaved form entries when the feed arrives.
  if (location.hash !== '#instellingen') render();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
