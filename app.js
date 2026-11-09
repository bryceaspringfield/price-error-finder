// Price error finder: filters the deals in items.json in the browser; choices persist in localStorage and the URL hash.
const $ = id => document.getElementById(id);
const DEFAULT = { cats: ['Electronics', 'Travel'], err: false, disc: 0, unk: false, pmin: '', pmax: '', honor: 0, age: 7, seller: '', q: '', live: false, sort: 'score', dir: -1 };
const FEEDS = { sd_price_error: 'Slickdeals', sd_pricing_error: 'Slickdeals', sd_glitch: 'Slickdeals', sd_frontpage: 'Slickdeals',
  sd_popular: 'Slickdeals', doc: 'Doctor of Credit', dansdeals: 'DansDeals', dealnews: 'dealnews', bensbargains: "Ben's Bargains",
  ccc_top_drops: 'camelcamelcamel', theflightdeal: 'The Flight Deal', fly4free_errors: 'Fly4free', rd_error_search: 'Reddit',
  rd_fare_search: 'Reddit' };
let data = null, st = load();

function load() {
  try {
    const h = location.hash.slice(1);
    if (h) return Object.assign({}, DEFAULT, JSON.parse(decodeURIComponent(h)));
    const s = localStorage.getItem('pef');
    if (s) return Object.assign({}, DEFAULT, JSON.parse(s));
  } catch (e) { /* a malformed saved state falls back to the defaults */ }
  return Object.assign({}, DEFAULT);
}
function save() {
  const s = JSON.stringify(st);
  localStorage.setItem('pef', s);
  history.replaceState(null, '', '#' + encodeURIComponent(s));
}
const usd = x => x == null ? '' : '$' + x.toLocaleString('en-US', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 });
const pct = x => x == null ? '' : Math.round(x * 100) + '%';
const score = it => (it.d == null ? 0.5 : it.d) * it.h;
const cls = x => x >= 0.5 ? 'hi' : x >= 0.25 ? 'md' : 'lo';
const et = ts => new Date(ts * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The cluster's check of the store's own page (verify.py): live, a higher price now, or not checked yet; gone deals are hidden.
function check(it) {
  const when = it.vt ? ' at ' + et(it.vt) + ' ET' : '';
  if (it.v === 'active') return `<span class="hi" title="Store page showed this price${when}">live</span>`;
  if (it.v === 'changed') return `<span class="lo" title="Store page showed ${usd(it.vp)}${when}">now ${usd(it.vp)}</span>`;
  if (it.v === 'unverified') return `<span title="The store page did not load or states no price${when}">unchecked</span>`;
  return '';
}

function controls() {
  $('cats').innerHTML = data.categories.map(c => `<button class="chip" aria-pressed="${st.cats.includes(c)}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('cats').onclick = e => {
    const c = e.target.dataset.c; if (!c) return;
    st.cats = st.cats.includes(c) ? st.cats.filter(x => x !== c) : st.cats.concat([c]);
    e.target.setAttribute('aria-pressed', st.cats.includes(c)); render();
  };
  $('all').onclick = () => { st.cats = data.categories.slice(); controls(); render(); };
  $('none').onclick = () => { st.cats = []; controls(); render(); };
  const sellers = [...new Set(data.items.map(i => i.s))].sort();
  $('seller').innerHTML = '<option value="">Any</option>' + sellers.map(s => `<option>${esc(s)}</option>`).join('');
  $('erronly').checked = st.err; $('disc').value = st.disc; $('unk').checked = st.unk; $('honor').value = st.honor;
  $('age').value = String(st.age); $('seller').value = st.seller; $('q').value = st.q;
  $('pmin').value = st.pmin; $('pmax').value = st.pmax; $('live').checked = st.live;
}

function render() {
  st.err = $('erronly').checked; st.disc = +$('disc').value; st.unk = $('unk').checked; st.honor = +$('honor').value;
  st.age = +$('age').value; st.seller = $('seller').value; st.q = $('q').value.trim();
  st.pmin = $('pmin').value; st.pmax = $('pmax').value; st.live = $('live').checked;
  const lo = st.pmin === '' ? -Infinity : +st.pmin, hi = st.pmax === '' ? Infinity : +st.pmax;
  $('discv').textContent = st.disc + '%'; $('honorv').textContent = st.honor + '%';
  save();
  const now = Date.now() / 1000, words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  let rows = data.items.filter(it =>
    st.cats.includes(it.c) && (!st.err || it.e) && (it.d == null ? st.unk : it.d * 100 >= st.disc) &&
    it.h * 100 >= st.honor && it.pr >= lo && it.pr <= hi && now - it.p <= st.age * 86400 && (!st.seller || it.s === st.seller) &&
    words.every(w => it.t.toLowerCase().includes(w)) && (!st.live || it.v === 'active') && it.v !== 'gone');
  const key = st.sort, val = it => key === 'score' ? score(it) : key === 'f' ? (FEEDS[it.f] || it.f) : it[key];
  rows.sort((a, b) => { const x = val(a), y = val(b); return (x == null) - (y == null) || (x < y ? -1 : x > y ? 1 : 0) * st.dir; });
  $('count').textContent = `${rows.length.toLocaleString()} of ${data.items.length.toLocaleString()} deals match.`;
  $('rows').innerHTML = rows.slice(0, 500).map(it => `<tr>
    <td>${et(it.p)}</td>
    <td class="ph">${it.i ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(it.i)}" alt="">` : ''}</td>
    <td><a href="${esc(it.vu || it.u)}" target="_blank" rel="noopener noreferrer">${esc(it.t)}</a>${it.e ? '<span class="err">price error</span>' : ''}</td>
    <td>${check(it)}</td>
    <td>${esc(it.c)}</td><td class="n">${usd(it.pr)}</td><td class="n">${usd(it.was)}</td><td class="n">${pct(it.d)}</td><td class="n">${pct(it.h)}</td>
    <td class="n ${cls(score(it))}">${pct(score(it))}</td><td>${esc(it.s)}</td><td><a href="${esc(it.src || it.u)}" target="_blank" rel="noopener noreferrer">${esc(FEEDS[it.f] || it.f)}</a></td></tr>`).join('');
}

document.querySelector('thead').onclick = e => {
  const k = e.target.dataset.k; if (!k) return;
  st.dir = st.sort === k ? -st.dir : (k === 't' || k === 'c' || k === 's' || k === 'f' ? 1 : -1); st.sort = k; render();
};
['erronly', 'disc', 'unk', 'honor', 'age', 'seller', 'q', 'pmin', 'pmax', 'live'].forEach(id => $(id).addEventListener('input', render));

fetch('items.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
  data = d;
  $('built').textContent = 'Data as of ' + et(d.built) + ' ET, covering the last ' + d.days + ' days.';
  controls(); render();
});
