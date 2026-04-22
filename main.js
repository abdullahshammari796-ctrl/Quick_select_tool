// ══════════════════════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════════════════════
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
  if (id === 'paradigm') drawParadigmTrees();
}

function switchLang(lang) {
  // hide all lang panes
  document.querySelectorAll('.lang-pane').forEach(p => p.style.display = 'none');
  // deactivate all lang tabs
  document.querySelectorAll('.lang-tab').forEach(b => b.classList.remove('active'));
  // show selected pane
  const pane = document.getElementById('lang-' + lang);
  if (pane) pane.style.display = 'block';
  // activate clicked tab
  event.currentTarget.classList.add('active');
}

function toggleCollapse(header) {
  const panel = header.parentElement;
  const body = header.nextElementSibling;
  panel.classList.toggle('collapsed');
  if (panel.classList.contains('collapsed')) {
    body.style.maxHeight = '0px';
    body.style.overflow = 'hidden';
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.style.overflow = '';
  }
}

// ══════════════════════════════════════════════════════
//  VISUALIZER ENGINE
// ══════════════════════════════════════════════════════
let steps = [], currentStep = 0, isPlaying = false, timer = null, origArr = [];
const svg = document.getElementById('main-svg');

function getCSSVar(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

const C = {
  default: '#58a6ff',
  pivot:   '#ffa657',
  compare: '#f78166',
  found:   '#7ee787',
  inactive:'#30363d'
};

function loadPreset(arr, k) {
  document.getElementById('array-input').value = arr.join(', ');
  document.getElementById('k-input').value = k;
  resetTool();
}

function loadPreset200(type, k) {
  let arr;
  if (type === 'random') {
    arr = Array.from({length:200}, () => Math.floor(Math.random()*999)+1);
  } else if (type === 'worst') {
    arr = Array.from({length:200}, (_,i) => 200-i); // descending → worst case with last-element pivot
  } else if (type === 'asc') {
    arr = Array.from({length:200}, (_,i) => i+1);
  } else if (type === 'small') {
    arr = [5,2,9,1,7,6,3,14,11,4,8,12,10,13,15];
    k = 5;
  }
  document.getElementById('array-input').value = arr.join(',');
  document.getElementById('k-input').value = Math.min(k, arr.length);
  resetTool();
}

function randomArray() {
  const n = 200;
  const arr = Array.from({length:n}, () => Math.floor(Math.random()*999)+1);
  document.getElementById('array-input').value = arr.join(',');
  document.getElementById('k-input').value = Math.ceil(n/2);
  resetTool();
}

function parseArr() {
  return document.getElementById('array-input').value.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
}

function setStatus(s) { document.getElementById('status-val').textContent = s; }
function setStepLabel(a, b) { document.getElementById('step-val').textContent = `${a}/${b}`; }
function setComp(n) { document.getElementById('comp-val').textContent = n; }
function setSwap(n) { document.getElementById('swap-val').textContent = n; }
function setProgress(a, b) { document.getElementById('progress-bar').style.width = (b ? (a/b*100) : 0) + '%'; }

function clearCode() {
  document.querySelectorAll('.code-line').forEach(l => l.classList.remove('active'));
}

function highlightLine(id) {
  clearCode();
  const el = document.getElementById('cl' + id);
  if (el) el.classList.add('active');
}

function resetTool() {
  isPlaying = false; clearTimeout(timer);
  currentStep = 0; steps = []; origArr = parseArr();
  setStatus('Ready'); setStepLabel(0, 0); setComp(0); setSwap(0); setProgress(0,1);
  document.getElementById('exp-text').innerHTML = 'Enter an array and click <strong>Build Steps</strong> to begin.';
  clearCode();
  document.getElementById('history-body').innerHTML = '';
  getSVGWidth(); // sync width before drawing
  drawArray(origArr, {});
  drawTree([]);
}

function buildSteps() {
  clearTimeout(timer); isPlaying = false; currentStep = 0;
  const arr = parseArr();
  const kIn = parseInt(document.getElementById('k-input').value);
  const k = kIn - 1;
  if (!arr.length) { alert('Enter a valid array.'); return; }
  if (isNaN(kIn) || k < 0 || k >= arr.length) { alert(`k must be between 1 and ${arr.length}.`); return; }
  origArr = [...arr];
  steps = [];
  let comps = 0, swps = 0;
  const treeNodes = [];

  function record(type, low, high, p, i, j, line, desc) {
    steps.push({ array:[...arr], type, low, high, pivot:p, i, j, line, desc, comp:comps, swap:swps });
  }

  function partition(l, r) {
    const pv = arr[r];
    let pi = l;
    record('partition-start', l, r, r, pi, -1, 12, `<strong>PARTITION</strong> subarray [${l}..${r}]. Pivot = A[${r}] = <strong>${pv}</strong>.`);
    for (let j = l; j < r; j++) {
      comps++;
      record('compare', l, r, r, pi, j, 15, `Compare A[${j}]=${arr[j]} with pivot ${pv}: ${arr[j] <= pv ? '≤ pivot → will swap' : '> pivot → skip'}.`);
      if (arr[j] <= pv) {
        const lv = arr[pi], rv = arr[j];
        [arr[pi], arr[j]] = [arr[j], arr[pi]];
        swps++;
        record('swap', l, r, r, pi, j, 16, `Swap A[${pi}]=${lv} ↔ A[${j}]=${rv}. i now = ${pi+1}.`);
        pi++;
      }
    }
    const old = arr[r], nvl = arr[pi];
    [arr[pi], arr[r]] = [arr[r], arr[pi]];
    swps++;
    record('pivot-final', l, r, pi, pi, -1, 17, `Place pivot <strong>${old}</strong> at final index ${pi} (swapped with ${nvl}). All left ≤ ${old}, all right ≥ ${old}.`);
    return pi;
  }

  function qs(l, r, depth) {
    if (l > r) return;
    const nodeId = treeNodes.length;
    treeNodes.push({ l, r, k, depth, pid: -1 });
    const parentId = steps.length > 0 ? steps[steps.length-1]?._nodeId ?? nodeId : nodeId;

    record('call', l, r, -1, -1, -1, 1, `<strong>QUICKSELECT</strong>(A, ${l}, ${r}, k=${k}). Search for ${kIn}-th smallest in indices [${l}..${r}].`);
    steps[steps.length-1]._nodeId = nodeId;
    steps[steps.length-1]._treeNodes = treeNodes.map(n => ({...n}));

    if (l === r) {
      record('done', l, r, l, l, -1, 3, `<strong>Base case</strong>: only one element A[${l}]=${arr[l]}. This IS the ${kIn}-th smallest = <strong>${arr[l]}</strong>! ✓`);
      steps[steps.length-1]._treeNodes = treeNodes.map(n => ({...n}));
      return;
    }

    let p = partition(l, r);
    steps.forEach(s => { if (!s._treeNodes) s._treeNodes = treeNodes.map(n => ({...n})); });

    if (p === k) {
      record('done', l, r, p, p, -1, 6, `<strong>Found!</strong> Pivot A[${p}]=${arr[p]} is at exactly index ${k} = position ${kIn}. Answer = <strong>${arr[p]}</strong> ✓`);
      steps[steps.length-1]._treeNodes = treeNodes.map(n => ({...n}));
    } else if (k < p) {
      record('recurse', l, p-1, -1, -1, -1, 8, `k=${k} &lt; p=${p}: answer is in LEFT half [${l}..${p-1}]. Discard right side.`);
      steps[steps.length-1]._treeNodes = treeNodes.map(n => ({...n}));
      qs(l, p-1, depth+1);
    } else {
      record('recurse', p+1, r, -1, -1, -1, 10, `k=${k} &gt; p=${p}: answer is in RIGHT half [${p+1}..${r}]. Discard left side.`);
      steps[steps.length-1]._treeNodes = treeNodes.map(n => ({...n}));
      qs(p+1, r, depth+1);
    }
  }

  qs(0, arr.length - 1, 0);
  setStatus('Ready');
  fillHistory();
  renderStep(0);
}

function renderStep(idx) {
  if (!steps.length) return;
  idx = Math.max(0, Math.min(idx, steps.length-1));
  currentStep = idx;
  const s = steps[idx];
  drawArray(s.array, s);
  document.getElementById('exp-text').innerHTML = s.desc;
  highlightLine(s.line);
  setStepLabel(idx+1, steps.length);
  setComp(s.comp); setSwap(s.swap);
  setProgress(idx+1, steps.length);
  // tree
  if (s._treeNodes) drawTree(s._treeNodes, s.low, s.high);
  // highlight history row
  document.querySelectorAll('#history-body tr').forEach((tr, i) => {
    tr.classList.toggle('current', i === idx);
  });
}

// ── Reliable SVG sizing via ResizeObserver ──────────
let _svgW = 800;
const _vizWrap = document.getElementById('viz-area-wrap');
if (window.ResizeObserver && _vizWrap) {
  new ResizeObserver(entries => {
    for (const e of entries) {
      const w = Math.floor(e.contentRect.width);
      if (w > 10 && w !== _svgW) {
        _svgW = w;
        svg.setAttribute('width', w);
        if (steps.length) renderStep(currentStep);
        else if (origArr.length) drawArray(origArr, {});
      }
    }
  }).observe(_vizWrap);
}

function getSVGWidth() {
  const w = _vizWrap ? _vizWrap.getBoundingClientRect().width : 0;
  if (w > 10) { _svgW = Math.floor(w); svg.setAttribute('width', _svgW); }
  return _svgW;
}

function drawArray(arr, s) {
  svg.innerHTML = '';
  if (!arr || !arr.length) return;
  const W = getSVGWidth();
  const H = 340;
  const n = arr.length;
  const isLarge = n > 40;
  const gap = isLarge ? 0 : 4;
  const bw = isLarge
    ? Math.max(1, (W - 2) / n)
    : Math.max(16, Math.min(50, (W - (n + 1) * gap) / n));
  const bottomPad = isLarge ? 16 : 38;
  const topPad    = isLarge ? 26 : 36;
  const max = Math.max(...arr, 1);
  const startX = isLarge ? 1 : (W - (n * (bw + gap) - gap)) / 2;

  arr.forEach((val, idx) => {
    const bh = Math.max(isLarge ? 1 : 4, (val / max) * (H - bottomPad - topPad));
    const x  = startX + idx * (bw + gap);
    const y  = H - bh - bottomPad;

    // ── Determine color & opacity based on state ──────────────
    let color   = C.default;   // default = blue (active region)
    let opacity = 1;

    const inActiveRange = s.low === undefined || s.high === undefined
      || (idx >= s.low && idx <= s.high);

    if (!inActiveRange) {
      // Discarded region — show as a muted teal/grey, still visible
      color   = '#3a7a6a';
      opacity = isLarge ? 0.55 : 0.45;
    }

    // Special roles override the above (these are always inside active range)
    if (idx === s.pivot)  { color = C.pivot;   opacity = 1; }   // orange
    if (idx === s.i)      { color = C.compare; opacity = 1; }   // red (i-pointer)
    if (idx === s.j && idx !== s.i) { color = '#e06cff'; opacity = 1; } // purple (j-scanner)

    // Done state — found element glows green
    if (s.type === 'done' && idx === s.pivot) { color = C.found; opacity = 1; }

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', Math.max(1, bw - (isLarge ? 0 : 2)));
    rect.setAttribute('height', bh);
    rect.setAttribute('fill', color);
    rect.setAttribute('opacity', opacity);
    if (!isLarge) rect.setAttribute('rx', 4);
    svg.appendChild(rect);

    if (!isLarge) {
      const tv = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tv.setAttribute('x', x + bw / 2); tv.setAttribute('y', H - 20);
      tv.setAttribute('text-anchor', 'middle');
      tv.setAttribute('fill', inActiveRange ? '#e6edf3' : '#6a9e94');
      tv.setAttribute('font-size', '12'); tv.setAttribute('font-family', 'JetBrains Mono,monospace');
      tv.textContent = val; svg.appendChild(tv);

      const ti = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ti.setAttribute('x', x + bw / 2); ti.setAttribute('y', H - 6);
      ti.setAttribute('text-anchor', 'middle');
      ti.setAttribute('fill', inActiveRange ? '#8b949e' : '#4a6e68');
      ti.setAttribute('font-size', '9'); ti.textContent = idx; svg.appendChild(ti);
    }
  });

  // ── Overlay markers for large arrays ──
  if (isLarge) {
    // Active region underline
    if (s.low !== undefined && s.high !== undefined && s.low >= 0) {
      const lx = startX + s.low  * (bw + gap);
      const rx = startX + s.high * (bw + gap) + bw;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', lx); ln.setAttribute('y1', H - 5);
      ln.setAttribute('x2', rx); ln.setAttribute('y2', H - 5);
      ln.setAttribute('stroke', '#58a6ff'); ln.setAttribute('stroke-width', '3');
      ln.setAttribute('opacity', '0.6'); svg.appendChild(ln);
      // boundary index labels
      [{ px: lx, idx: s.low, anchor: 'start' }, { px: rx, idx: s.high, anchor: 'end' }].forEach(m => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', m.anchor === 'start' ? m.px + 2 : m.px - 2);
        t.setAttribute('y', H - 7); t.setAttribute('text-anchor', m.anchor);
        t.setAttribute('fill', '#58a6ff'); t.setAttribute('font-size', '9');
        t.setAttribute('font-family', 'JetBrains Mono,monospace');
        t.textContent = m.idx; svg.appendChild(t);
      });
    }

    // Triangle pointers for pivot / i / j
    const markers = [];
    if (s.pivot !== undefined && s.pivot >= 0)
      markers.push({ idx: s.pivot, color: C.pivot,   label: `pivot[${s.pivot}]=${arr[s.pivot]}` });
    if (s.i !== undefined && s.i >= 0 && s.i !== s.pivot)
      markers.push({ idx: s.i,     color: C.compare, label: `i[${s.i}]` });
    if (s.j !== undefined && s.j >= 0 && s.j !== s.pivot && s.j !== s.i)
      markers.push({ idx: s.j,     color: '#e06cff',  label: `j[${s.j}]=${arr[s.j]}` });

    markers.forEach((m, mi) => {
      const val = arr[m.idx];
      const bh  = Math.max(1, (val / max) * (H - bottomPad - topPad));
      const cx  = startX + m.idx * (bw + gap) + bw / 2;
      const ty  = H - bh - bottomPad - 4;
      // triangle
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', `${cx - 5},${ty - 8} ${cx + 5},${ty - 8} ${cx},${ty}`);
      poly.setAttribute('fill', m.color); svg.appendChild(poly);
      // label (offset alternating markers so they don't overlap)
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', cx);
      lbl.setAttribute('y', ty - 11 - (mi * 14));
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', m.color);
      lbl.setAttribute('font-size', '10'); lbl.setAttribute('font-family', 'JetBrains Mono,monospace');
      lbl.setAttribute('font-weight', '600'); lbl.textContent = m.label; svg.appendChild(lbl);
    });

    // found highlight
    if (s.type === 'done' && s.pivot >= 0) {
      const val = arr[s.pivot];
      const bh  = Math.max(1, (val / max) * (H - bottomPad - topPad));
      const cx  = startX + s.pivot * (bw + gap) + bw / 2;
      const ty  = H - bh - bottomPad - 4;
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', cx); lbl.setAttribute('y', ty - 11);
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', C.found);
      lbl.setAttribute('font-size', '11'); lbl.setAttribute('font-family', 'JetBrains Mono,monospace');
      lbl.setAttribute('font-weight', '600'); lbl.textContent = `✓ ${val} (k=${arr[s.pivot]})`; svg.appendChild(lbl);
    }
  } else {
    // small-array pivot label
    if (s.pivot !== undefined && s.pivot >= 0 && s.type !== 'done') {
      const val = arr[s.pivot];
      const bh  = Math.max(4, (val / max) * (H - bottomPad - topPad));
      const x   = startX + s.pivot * (bw + gap);
      const y   = H - bh - bottomPad;
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', x + bw / 2); lbl.setAttribute('y', y - 6);
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('fill', '#ffa657');
      lbl.setAttribute('font-size', '10'); lbl.textContent = 'pivot'; svg.appendChild(lbl);
    }
  }
}

function drawTree(nodes, activeLow, activeHigh) {
  const ts = document.getElementById('tree-svg');
  ts.innerHTML = '';
  if (!nodes || !nodes.length) return;
  const W = ts.clientWidth || 500;
  const H = 300;
  const levelH = 60;
  const maxDepth = Math.max(...nodes.map(n=>n.depth));

  // Layout nodes
  const byDepth = {};
  nodes.forEach(n => { (byDepth[n.depth] = byDepth[n.depth]||[]).push(n); });

  const positions = nodes.map((n, i) => {
    const siblings = byDepth[n.depth];
    const pos = siblings.indexOf(n);
    const totalAtLevel = siblings.length;
    const x = (W / (totalAtLevel+1)) * (pos+1);
    const y = 24 + n.depth * levelH;
    return { x, y };
  });

  // Draw edges
  nodes.forEach((n, i) => {
    if (i === 0) return;
    // find parent (last node with depth-1)
    for (let j = i-1; j >= 0; j--) {
      if (nodes[j].depth === n.depth - 1) {
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1', positions[j].x); line.setAttribute('y1', positions[j].y+14);
        line.setAttribute('x2', positions[i].x); line.setAttribute('y2', positions[i].y-14);
        line.setAttribute('stroke','#30363d'); line.setAttribute('stroke-width','1.5');
        ts.appendChild(line);
        break;
      }
    }
  });

  nodes.forEach((n, i) => {
    const {x, y} = positions[i];
    const isActive = (activeLow === n.l && activeHigh === n.r);
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y);
    circle.setAttribute('r', 20);
    circle.setAttribute('fill', isActive ? 'rgba(88,166,255,0.2)' : '#161b22');
    circle.setAttribute('stroke', isActive ? '#58a6ff' : '#30363d');
    circle.setAttribute('stroke-width', isActive ? 2 : 1);
    ts.appendChild(circle);

    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', x); txt.setAttribute('y', y+4);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('fill', isActive ? '#58a6ff' : '#8b949e');
    txt.setAttribute('font-size','9'); txt.setAttribute('font-family','JetBrains Mono,monospace');
    txt.textContent = `[${n.l},${n.r}]`; ts.appendChild(txt);
  });
}

function fillHistory() {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  steps.forEach((s, i) => {
    const tr = document.createElement('tr');
    const regionStr = s.low !== undefined && s.high !== undefined && s.low >= 0 ? `[${s.low}..${s.high}]` : '—';
    const plain = s.desc.replace(/<[^>]+>/g,'');
    tr.innerHTML = `<td>${i+1}</td><td>${plain.length>35?plain.slice(0,35)+'…':plain}</td><td>${regionStr}</td>`;
    tr.onclick = () => { isPlaying=false; clearTimeout(timer); renderStep(i); setStatus('Jumped'); };
    tbody.appendChild(tr);
  });
}

function stepForward() {
  if (!steps.length) return;
  if (currentStep < steps.length-1) { renderStep(currentStep+1); setStatus('Stepping'); }
  else setStatus('Finished');
}

function playAnim() {
  if (!steps.length || currentStep >= steps.length-1) return;
  isPlaying = true; setStatus('Playing');
  function tick() {
    if (!isPlaying || currentStep >= steps.length-1) { isPlaying=false; if(currentStep>=steps.length-1) setStatus('Finished'); return; }
    renderStep(currentStep+1);
    const spd = 1000 / parseFloat(document.getElementById('speed-slider').value);
    timer = setTimeout(tick, spd);
  }
  clearTimeout(timer); tick();
}

function pauseAnim() { isPlaying=false; clearTimeout(timer); setStatus('Paused'); }

window.addEventListener('resize', () => { if (steps.length) renderStep(currentStep); else drawArray(origArr, {}); });

// Use requestAnimationFrame to guarantee layout is complete before first draw
function initDraw() {
  origArr = parseArr();
  if (getSVGWidth() > 10) {
    drawArray(origArr, {});
  } else {
    setTimeout(initDraw, 100);
  }
}
requestAnimationFrame(() => setTimeout(initDraw, 50));

// ══════════════════════════════════════════════════════
//  CLO-1 COMPLEXITY CALCULATOR
// ══════════════════════════════════════════════════════
function updateCLO1() {
  const n = parseInt(document.getElementById('clo1-n').value) || 10;
  const qsAvg = Math.round(2 * n);
  const qsWorst = Math.round(n*(n+1)/2);
  const sortAvg = Math.round(n * Math.log2(n) * 1.39);
  document.getElementById('qs-avg').textContent = qsAvg;
  document.getElementById('qs-worst').textContent = qsWorst;
  document.getElementById('sort-avg').textContent = sortAvg;
  const ratio = (qsWorst/sortAvg).toFixed(1);
  document.getElementById('clo1-insight').textContent =
    `For n=${n}: Quickselect average (${qsAvg}) is ${(sortAvg/qsAvg).toFixed(1)}× faster than sort (${sortAvg}). Worst case (${qsWorst}) is ${ratio}× slower than sort.`;
}
updateCLO1();

// ══════════════════════════════════════════════════════
//  CLO-3 PARADIGM TREES
// ══════════════════════════════════════════════════════
function drawParadigmTrees() {
  const s = document.getElementById('tree-svg-paradigm');
  const W = s.clientWidth || 800;
  const H = 280;
  s.innerHTML = '';

  // Helper
  function node(x, y, label, color, dim) {
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',22);
    c.setAttribute('fill', dim ? '#1c2230' : color+'33'); c.setAttribute('stroke', dim ? '#30363d' : color); c.setAttribute('stroke-width','2');
    s.appendChild(c);
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x); t.setAttribute('y',y+4);
    t.setAttribute('text-anchor','middle'); t.setAttribute('fill', dim ? '#30363d' : color);
    t.setAttribute('font-size','9'); t.setAttribute('font-family','JetBrains Mono,monospace');
    t.textContent = label; s.appendChild(t);
  }
  function edge(x1,y1,x2,y2,color,dim) {
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke', dim?'#21283a':color); l.setAttribute('stroke-width','2');
    if(dim) l.setAttribute('stroke-dasharray','4,4');
    s.appendChild(l);
  }
  function label(x, y, txt, color) {
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('text-anchor','middle');
    t.setAttribute('fill',color); t.setAttribute('font-size','12');
    t.setAttribute('font-family','DM Sans,sans-serif'); t.setAttribute('font-weight','600');
    t.textContent = txt; s.appendChild(t);
  }

  const half = W / 2;

  // QUICKSORT (left side)
  label(half/2, 18, 'Quicksort — BOTH sides', '#f78166');
  const qs_y = [40, 100, 160, 220];
  edge(half/2, qs_y[0]+22, half/2-70, qs_y[1]-22, '#f78166', false);
  edge(half/2, qs_y[0]+22, half/2+70, qs_y[1]-22, '#f78166', false);
  edge(half/2-70, qs_y[1]+22, half/2-110, qs_y[2]-22, '#f78166', false);
  edge(half/2-70, qs_y[1]+22, half/2-30, qs_y[2]-22, '#f78166', false);
  edge(half/2+70, qs_y[1]+22, half/2+30, qs_y[2]-22, '#f78166', false);
  edge(half/2+70, qs_y[1]+22, half/2+110, qs_y[2]-22, '#f78166', false);
  node(half/2, qs_y[0], '[0..6]', '#f78166', false);
  node(half/2-70, qs_y[1], '[0..2]', '#f78166', false);
  node(half/2+70, qs_y[1], '[4..6]', '#f78166', false);
  node(half/2-110, qs_y[2], '[0..1]', '#f78166', false);
  node(half/2-30, qs_y[2], '[2..2]', '#f78166', false);
  node(half/2+30, qs_y[2], '[4..5]', '#f78166', false);
  node(half/2+110, qs_y[2], '[6..6]', '#f78166', false);

  // QUICKSELECT (right side)
  const rx = half + half/2;
  label(rx, 18, 'Quickselect — ONE side', '#7ee787');
  edge(rx, qs_y[0]+22, rx-70, qs_y[1]-22, '#30363d', true);  // discarded
  edge(rx, qs_y[0]+22, rx+70, qs_y[1]-22, '#7ee787', false);  // active
  edge(rx+70, qs_y[1]+22, rx+30, qs_y[2]-22, '#30363d', true);
  edge(rx+70, qs_y[1]+22, rx+110, qs_y[2]-22, '#7ee787', false);
  edge(rx+110, qs_y[2]+22, rx+90, qs_y[3]-22, '#7ee787', false);
  node(rx, qs_y[0], '[0..6]', '#7ee787', false);
  node(rx-70, qs_y[1], '[0..2]', '#30363d', true);
  node(rx+70, qs_y[1], '[4..6]', '#7ee787', false);
  node(rx+30, qs_y[2], '[4..5]', '#30363d', true);
  node(rx+110, qs_y[2], '[6..6]', '#7ee787', false);
  node(rx+110, qs_y[3], 'FOUND', '#7ee787', false);

  // divider
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', half); line.setAttribute('y1', 0); line.setAttribute('x2', half); line.setAttribute('y2', H);
  line.setAttribute('stroke','#30363d'); line.setAttribute('stroke-width','1'); line.setAttribute('stroke-dasharray','4,4');
  s.appendChild(line);
}

// ══════════════════════════════════════════════════════
//  GROWTH CURVE & BAR CHART (CLO-1)
// ══════════════════════════════════════════════════════
function drawGrowthCurve() {
  const canvas = document.getElementById('growth-canvas');
  if (!canvas) return;
  const maxN = parseInt(document.getElementById('growth-n').value);
  document.getElementById('growth-n-label').textContent = maxN;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#010409';
  ctx.fillRect(0, 0, W, H);

  const pts = 200;
  const lines = [
    { label: 'O(log n)',    color: '#d2a8ff', fn: n => Math.log2(n) },
    { label: 'O(n)',        color: '#7ee787', fn: n => n },
    { label: 'O(n log n)',  color: '#58a6ff', fn: n => n * Math.log2(n) },
    { label: 'O(n²)',       color: '#ffa657', fn: n => n * n },
    { label: 'O(2ⁿ)',       color: '#f78166', fn: n => Math.pow(2, n), cap: true },
  ];

  // compute max y (cap exponential at 2^20)
  const maxY = lines.reduce((mx, l) => {
    const v = Math.min(l.fn(maxN), 1e7);
    return Math.max(mx, v);
  }, 0);

  function toX(n) { return PAD.left + ((n - 1) / (maxN - 1)) * plotW; }
  function toY(v) { return PAD.top + plotH - (Math.min(v, maxY) / maxY) * plotH; }

  // grid
  ctx.strokeStyle = '#1c2230'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PAD.top + (i / 5) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
    const val = maxY * (1 - i / 5);
    ctx.fillStyle = '#8b949e'; ctx.font = '10px JetBrains Mono,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1e6 ? (val/1e6).toFixed(1)+'M' : val >= 1e3 ? (val/1e3).toFixed(0)+'K' : val.toFixed(0), PAD.left - 6, y + 4);
  }
  // x-axis ticks
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const n = Math.round(1 + (i / 5) * (maxN - 1));
    const x = toX(n);
    ctx.fillStyle = '#8b949e'; ctx.font = '10px JetBrains Mono,monospace';
    ctx.fillText(n, x, H - 8);
    ctx.strokeStyle = '#1c2230'; ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + plotH); ctx.stroke();
  }
  // axis labels
  ctx.fillStyle = '#8b949e'; ctx.font = '11px DM Sans,sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('n (input size)', W / 2, H - 2);
  ctx.save(); ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('operations', 0, 0); ctx.restore();

  // draw lines
  lines.forEach(l => {
    ctx.strokeStyle = l.color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    if (l.label === 'O(2ⁿ)') ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= pts; i++) {
      const n = 1 + (i / pts) * (maxN - 1);
      const v = Math.min(l.fn(n), maxY);
      const x = toX(n), y = toY(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // end label
    const endN = maxN;
    const endV = Math.min(l.fn(endN), maxY);
    const ey = toY(endV);
    if (ey > PAD.top + 10 && ey < PAD.top + plotH - 4) {
      ctx.fillStyle = l.color; ctx.font = 'bold 10px JetBrains Mono,monospace';
      ctx.textAlign = 'left'; ctx.fillText(l.label, PAD.left + plotW + 4, ey + 4);
    }
  });
}

function drawBarChart() {
  const canvas = document.getElementById('bar-canvas');
  if (!canvas) return;
  const n = parseInt(document.getElementById('bar-n').value);
  document.getElementById('bar-n-label').textContent = n;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#010409'; ctx.fillRect(0, 0, W, H);

  const algos = [
    { label: 'Quickselect\n(avg)',      color: '#7ee787', val: 2 * n },
    { label: 'Quickselect\n(worst)',    color: '#ffa657', val: n * (n + 1) / 2 },
    { label: 'Heap Select\n(k=n/2)',    color: '#58a6ff', val: n + Math.ceil(n/2) * Math.log2(n) },
    { label: 'Quicksort\n(avg)',        color: '#d2a8ff', val: Math.round(n * Math.log2(n) * 1.39) },
    { label: 'Merge Sort',              color: '#79c0ff', val: Math.round(n * Math.log2(n)) },
    { label: 'Sort+Index\n(O(n log n))',color: '#a5d6ff', val: Math.round(n * Math.log2(n) * 1.39) },
  ];

  const PAD = { top: 18, right: 24, bottom: 60, left: 70 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...algos.map(a => a.val));
  const barW = Math.floor(plotW / algos.length) - 10;

  // grid
  ctx.strokeStyle = '#1c2230'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
    const v = maxVal * (1 - i / 4);
    ctx.fillStyle = '#8b949e'; ctx.font = '10px JetBrains Mono,monospace'; ctx.textAlign = 'right';
    ctx.fillText(v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v.toFixed(0), PAD.left - 5, y + 4);
  }

  algos.forEach((a, i) => {
    const bh = (a.val / maxVal) * plotH;
    const x = PAD.left + i * (plotW / algos.length) + 5;
    const y = PAD.top + plotH - bh;

    // bar with gradient effect
    const grad = ctx.createLinearGradient(x, y, x, y + bh);
    grad.addColorStop(0, a.color);
    grad.addColorStop(1, a.color + '55');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, bh, [4, 4, 0, 0]) : ctx.rect(x, y, barW, bh);
    ctx.fill();

    // value on top
    ctx.fillStyle = a.color; ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.textAlign = 'center';
    const valStr = a.val >= 1e6 ? (a.val/1e6).toFixed(1)+'M' : a.val >= 1e3 ? (a.val/1e3).toFixed(0)+'K' : a.val.toString();
    ctx.fillText(valStr, x + barW / 2, y - 5);

    // x label (multi-line)
    const lines = a.label.split('\n');
    ctx.fillStyle = '#8b949e'; ctx.font = '10px DM Sans,sans-serif';
    lines.forEach((ln, li) => ctx.fillText(ln, x + barW / 2, PAD.top + plotH + 14 + li * 13));
  });

  const qs = algos[0].val, sort = algos[3].val;
  document.getElementById('bar-insight').textContent =
    `At n=${n}: Quickselect average uses ~${qs.toLocaleString()} operations vs Quicksort's ~${sort.toLocaleString()} — that's ${(sort/qs).toFixed(1)}× fewer. Worst case (${algos[1].val.toLocaleString()}) shows why good pivot selection matters.`;
}

// init charts when tab is opened — patch switchTab
const _origSwTab = window.switchTab;
window.switchTab = function(id) {
  _origSwTab.call(this, id);
  if (id === 'complexity') setTimeout(() => { drawGrowthCurve(); drawBarChart(); }, 60);
};
setTimeout(() => {
  if (document.getElementById('growth-canvas')) { drawGrowthCurve(); drawBarChart(); }
}, 400);

// ══════════════════════════════════════════════════════
//  QUIZ ENGINE  (30-question pool, 15 per session, shuffle)
// ══════════════════════════════════════════════════════
const ALL_QUESTIONS = [
  // ── Layer 1: Describe ──────────────────────────────
  {
    layer: 'Layer 1 — Describe', type: 'single',
    q: 'What does Quickselect return for k=3 on array [5, 2, 9, 1, 7]?',
    opts: ['5', '2', '7', '1'],
    correct: [0],
    explain: 'Sorted: [1,2,5,7,9]. The 3rd smallest is 5.'
  },
  {
    layer: 'Layer 1 — Describe', type: 'single',
    q: 'After PARTITION on [5,2,9,1,7,6,3] with pivot=A[6]=3, what is the pivot\'s final index?',
    opts: ['0', '1', '2', '3'],
    correct: [2],
    explain: 'Elements ≤ 3: {2,1} → 2 elements before pivot → pivot lands at index 2. Array: [2,1,3,5,7,6,9].'
  },
  {
    layer: 'Layer 1 — Describe', type: 'single',
    q: 'What is the "k-th order statistic" of an array?',
    opts: [
      'The k-th element after sorting in ascending order',
      'The element at index k-1 in the original array',
      'The k-th largest element',
      'The element that appears k times'
    ],
    correct: [0],
    explain: 'The k-th order statistic is the k-th smallest element — i.e. A[k-1] after sorting in ascending order.'
  },
  {
    layer: 'Layer 1 — Describe', type: 'single',
    q: 'In PARTITION, where is the pivot placed at the start of the function?',
    opts: [
      'At index low',
      'At the middle of the array',
      'At index high (last element)',
      'At a random index'
    ],
    correct: [2],
    explain: 'The standard Lomuto partition scheme uses A[high] as the pivot, keeping it at the end until the final swap.'
  },
  {
    layer: 'Layer 1 — Describe', type: 'multi',
    q: 'Select ALL that are true about PARTITION\'s output: (choose 2 or more)',
    opts: [
      'A[p] is at its final sorted position',
      'All elements in A[low..p-1] are ≤ A[p]',
      'All elements are fully sorted',
      'All elements in A[p+1..high] are ≥ A[p]'
    ],
    correct: [0, 1, 3],
    explain: 'PARTITION guarantees: pivot at final position, left side ≤ pivot, right side ≥ pivot. The rest of the array is NOT sorted.'
  },
  // ── Layer 2: Analyze ──────────────────────────────
  {
    layer: 'Layer 2 — Analyze', type: 'single',
    q: 'What is the average-case time complexity of Quickselect?',
    opts: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'],
    correct: [2],
    explain: 'T(n) = T(n/2) + n → geometric series: n + n/2 + n/4 + ... = 2n → O(n).'
  },
  {
    layer: 'Layer 2 — Analyze', type: 'single',
    q: 'When does Quickselect degrade to O(n²)?',
    opts: [
      'When k = n/2 (median)',
      'When the pivot is always the minimum or maximum element',
      'When the array has duplicate values',
      'When n is a power of 2'
    ],
    correct: [1],
    explain: 'If pivot is always min/max, only one element is eliminated per call: T(n) = T(n-1) + n → O(n²).'
  },
  {
    layer: 'Layer 2 — Analyze', type: 'single',
    q: 'Which recurrence correctly describes Quickselect\'s average case?',
    opts: [
      'T(n) = 2T(n/2) + O(n)',
      'T(n) = T(n/2) + O(n)',
      'T(n) = T(n-1) + O(n)',
      'T(n) = T(n/4) + O(1)'
    ],
    correct: [1],
    explain: 'On average, partition splits the array roughly in half and we recurse into one side: T(n) = T(n/2) + n.'
  },
  {
    layer: 'Layer 2 — Analyze', type: 'multi',
    q: 'Which complexity classes apply to Quickselect? (select ALL correct)',
    opts: [
      'O(n) — best case',
      'O(n) — average case',
      'O(n²) — worst case',
      'O(n log n) — worst case'
    ],
    correct: [0, 1, 2],
    explain: 'Best: O(n) (pivot lands at k immediately). Average: O(n). Worst: O(n²) (always bad pivot). It is NOT O(n log n) worst case.'
  },
  {
    layer: 'Layer 2 — Analyze', type: 'single',
    q: 'Quickselect\'s space complexity (for the call stack) is:',
    opts: ['O(1)', 'O(log n) average / O(n) worst', 'O(n)', 'O(n log n)'],
    correct: [1],
    explain: 'The recursion depth is O(log n) on average (each call halves the range) but O(n) worst case.'
  },
  // ── Layer 3: Justify ──────────────────────────────
  {
    layer: 'Layer 3 — Justify', type: 'single',
    q: 'Why is it safe to discard the half that does NOT contain k?',
    opts: [
      'Because PARTITION sorts that half fully',
      'Because all elements in the discarded half are either all ≤ A[p] or all ≥ A[p], and the k-th smallest cannot be there',
      'Because those elements are duplicates',
      'Because we already know their values'
    ],
    correct: [1],
    explain: 'After partition: left side ≤ A[p] and right side ≥ A[p]. If k < p, the answer must be in the left; if k > p, in the right. The other side cannot contain the k-th smallest.'
  },
  {
    layer: 'Layer 3 — Justify', type: 'single',
    q: 'Why does Quickselect use Divide & Conquer but NOT Dynamic Programming?',
    opts: [
      'DP requires a graph structure',
      'Quickselect subproblems are disjoint (no overlap), so memoization gives no benefit',
      'Quickselect uses greedy choices at each step',
      'DP always requires O(n²) space'
    ],
    correct: [1],
    explain: 'DP is for overlapping subproblems. Each Quickselect call operates on a disjoint subarray [low..high] that never repeats.'
  },
  {
    layer: 'Layer 3 — Justify', type: 'multi',
    q: 'Which statements correctly describe the PARTITION loop invariant? (select ALL that apply)',
    opts: [
      'A[low..i] contains all elements ≤ pivot',
      'A[i+1..j-1] contains all elements > pivot',
      'A[high] holds the pivot unchanged throughout the loop',
      'The array is fully sorted after the loop'
    ],
    correct: [0, 1, 2],
    explain: 'The three-part invariant: left segment ≤ pivot, middle segment > pivot, pivot stays at A[high]. The array is NOT sorted — only partitioned.'
  },
  {
    layer: 'Layer 3 — Justify', type: 'single',
    q: 'In the inductive proof of Quickselect correctness, what is the inductive hypothesis?',
    opts: [
      'Quickselect works on arrays of size n+1',
      'Quickselect correctly finds the k-th smallest in any array of size < (high−low+1)',
      'PARTITION always places the pivot at the exact median',
      'The array is sorted after at most n recursive calls'
    ],
    correct: [1],
    explain: 'We assume Quickselect works on all SMALLER subproblems, then show it works for size n by using partition + recursing into a strictly smaller subrange.'
  },
  {
    layer: 'Layer 3 — Justify', type: 'single',
    q: 'T(n) = T(n/2) + n — which Master Theorem case applies here?',
    opts: [
      'Case 1: f(n) = O(n^(log_b(a) − ε))',
      'Case 2: f(n) = Θ(n^log_b(a))',
      'Case 3: f(n) = Ω(n^(log_b(a) + ε))',
      'Master Theorem does not apply (b is not constant)'
    ],
    correct: [2],
    explain: 'a=1, b=2 → log₂(1)=0. f(n)=n=Ω(n^ε). Case 3 applies → T(n)=Θ(n).'
  },
  // ── Layer 4: Connect ──────────────────────────────
  {
    layer: 'Layer 4 — Connect', type: 'single',
    q: 'What is the key structural difference between Quickselect and Quicksort?',
    opts: [
      'Quicksort uses a different partition function',
      'Both recurse into BOTH halves',
      'Quickselect recurses into ONE half; Quicksort recurses into BOTH halves',
      'Quickselect is not recursive'
    ],
    correct: [2],
    explain: 'This single difference makes Quickselect O(n) average vs O(n log n) for Quicksort. T(n)=T(n/2)+n vs T(n)=2T(n/2)+n.'
  },
  {
    layer: 'Layer 4 — Connect', type: 'single',
    q: 'When should you choose Median of Medians over Quickselect?',
    opts: [
      'When average-case speed is most important',
      'When you need a guaranteed O(n) worst-case (adversarial inputs)',
      'When the array is small (n < 10)',
      'When k = 1 (finding minimum)'
    ],
    correct: [1],
    explain: 'MoM guarantees O(n) worst case. Quickselect is faster in practice but O(n²) worst case on adversarial inputs.'
  },
  {
    layer: 'Layer 4 — Connect', type: 'multi',
    q: 'Which algorithms share the PARTITION subroutine with Quickselect? (select ALL)',
    opts: ['Quicksort', 'Merge Sort', 'Introselect', 'Median of Medians'],
    correct: [0, 2],
    explain: 'Quicksort and Introselect both use PARTITION. Merge Sort uses merge(). Median of Medians uses its own grouping + selection step, though it calls Quickselect internally.'
  },
  {
    layer: 'Layer 4 — Connect', type: 'single',
    q: 'Binary Search runs in O(log n). Quickselect runs in O(n) average. Why is Quickselect slower despite also "discarding half the input" each time?',
    opts: [
      'Quickselect does more work because PARTITION must scan the entire active subarray (O(n) per call), while Binary Search does O(1) work per step',
      'Quickselect is actually faster than Binary Search',
      'Binary Search also runs in O(n)',
      'Quickselect recurses into both halves'
    ],
    correct: [0],
    explain: 'Binary Search does O(1) comparison per step then discards half. Quickselect does O(n) work (full partition scan) then discards half. Hence O(log n) vs O(n).'
  },
  {
    layer: 'Layer 4 — Connect', type: 'single',
    q: 'Introselect combines Quickselect and Median of Medians. What is its purpose?',
    opts: [
      'It is always faster than both',
      'It uses Quickselect normally but falls back to Median of Medians if recursion depth exceeds O(log n) — guaranteeing O(n) worst case with low constant factor',
      'It sorts the full array first',
      'It only works on integer arrays'
    ],
    correct: [1],
    explain: 'Introselect is a hybrid: fast like Quickselect in practice, but automatically switches to MoM to prevent O(n²) worst case. Used in C++ std::nth_element.'
  },
  // ── Layer 5: Extend ──────────────────────────────
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'To find the k-th LARGEST element with minimal change, you would:',
    opts: [
      'Reverse sort the array first',
      'Use k\' = n − k (0-indexed) and call Quickselect normally',
      'Run Quickselect k times and remove the maximum each time',
      'Change the comparison in PARTITION from ≤ to ≥'
    ],
    correct: [1],
    explain: 'k-th largest = (n−k)-th smallest (0-indexed). Translate the target index and the rest is identical.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'What happens to Quickselect\'s complexity with RANDOMIZED pivot selection?',
    opts: [
      'Worst case becomes O(n)',
      'Expected time remains O(n) but no fixed input can cause O(n²) — adversarial inputs are defeated',
      'It becomes O(log n)',
      'Average case degrades to O(n log n)'
    ],
    correct: [1],
    explain: 'Random pivot: expected O(n), no deterministic adversary can trigger worst case. The expected complexity proof uses linearity of expectation over random pivot choices.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'How would you modify Quickselect to find the MEDIAN of an unsorted array efficiently?',
    opts: [
      'Call Quickselect with k = n/2 — that\'s already O(n) on average',
      'Sort the array first then take middle element',
      'Use a heap to find the median',
      'You cannot find the median without sorting'
    ],
    correct: [0],
    explain: 'The median is just the ⌊n/2⌋-th order statistic. Call Quickselect(A, 0, n-1, ⌊n/2⌋). Average O(n). This is optimal in the comparison model.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'multi',
    q: 'Suppose the array has many duplicates (e.g., only 3 distinct values). Which modifications would improve Quickselect? (select ALL)',
    opts: [
      '3-way partition (Dutch National Flag) to handle equal elements in O(1) group',
      'Randomized pivot to avoid always picking the same value',
      'Sort the array first since duplicates make quickselect fail',
      'Fat partition — elements equal to pivot are placed in their final position immediately'
    ],
    correct: [0, 1, 3],
    explain: 'With many duplicates, 3-way/fat partition groups elements as (<pivot), (=pivot), (>pivot). All =pivot elements are resolved in one partition. Randomization still helps avoid patterns. Sorting first is unnecessarily slow.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'If you need to find the TOP-k elements (all k smallest, not just the k-th), how does Quickselect help?',
    opts: [
      'Run Quickselect k times, each time finding the minimum',
      'Use Quickselect to find the k-th smallest as a threshold, then scan once to collect all elements ≤ that threshold — total O(n)',
      'Sort the array and take first k elements',
      'Quickselect cannot help with top-k'
    ],
    correct: [1],
    explain: 'Step 1: Quickselect finds pivot = k-th smallest in O(n) avg. Step 2: One linear scan collects all ≤ pivot. Total: O(n). Much better than O(n log k) heap-based approaches for large n.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'CLRS proves Quickselect\'s average is O(n) using "indicator random variables." What is the key insight?',
    opts: [
      'The expected number of comparisons equals n',
      'By computing the expected number of comparisons as a sum over all pairs (i,j), element i is compared to element j only if one is the first pivot chosen from the range [i..j] — giving E[comparisons] = O(n)',
      'All pivots are always the median',
      'The recursion depth is always exactly log₂n'
    ],
    correct: [1],
    explain: 'The CLRS analysis defines X_ij = 1 if elements i and j are ever compared. P(X_ij=1) = 2/(j-i+1). Summing gives E[total comparisons] = O(n). This is identical to the Quicksort analysis but sums over a triangular (not full) region.'
  },
  {
    layer: 'Layer 1 — Describe', type: 'single',
    q: 'What is the base case of Quickselect\'s recursion?',
    opts: [
      'When the array is sorted',
      'When low == high (only one element in range)',
      'When the pivot equals k',
      'When comparisons exceed n'
    ],
    correct: [1],
    explain: 'When low == high, only one element remains in the search range. It must be the k-th smallest, so we return A[low].'
  },
  {
    layer: 'Layer 2 — Analyze', type: 'single',
    q: 'How many comparisons does PARTITION perform on a subarray of size m?',
    opts: ['m/2', 'm − 1', 'm', 'm log m'],
    correct: [1],
    explain: 'PARTITION compares A[j] to the pivot for j from low to high−1, which is (high−low) = m−1 comparisons.'
  },
  {
    layer: 'Layer 3 — Justify', type: 'multi',
    q: 'Which properties must hold for the PARTITION invariant to be maintained? (select ALL)',
    opts: [
      'When A[j] ≤ pivot: increment i, swap A[i] and A[j]',
      'When A[j] > pivot: do nothing (j advances)',
      'When A[j] > pivot: swap with pivot immediately',
      'After the loop: swap A[i+1] with A[high] to place pivot'
    ],
    correct: [0, 1, 3],
    explain: 'The three actions maintain the invariant: small elements move left (swap), large elements stay right (no-op), and the final swap places the pivot at i+1.'
  },
  {
    layer: 'Layer 4 — Connect', type: 'single',
    q: 'Merge Sort always runs in O(n log n) while Quickselect averages O(n). What does Quickselect trade away to achieve this?',
    opts: [
      'Stability — Quickselect does not preserve relative order of equal elements',
      'Completeness — Quickselect only partially "sorts" the array, finding one position',
      'Correctness — Quickselect sometimes returns the wrong answer',
      'It trades away nothing; Quickselect is strictly better'
    ],
    correct: [1],
    explain: 'Merge Sort fully sorts the array. Quickselect answers only "what is at position k?" — it finds ONE order statistic and leaves the rest partially arranged. Solving a harder problem (full sort) necessarily costs more.'
  },
  {
    layer: 'Layer 5 — Extend', type: 'single',
    q: 'On a SORTED array [1,2,3,...,n], calling Quickselect with the last element as pivot gives which time complexity?',
    opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(1)'],
    correct: [2],
    explain: 'On a sorted ascending array with last-element pivot: pivot is always the maximum. PARTITION returns p = high, so we recurse on [low..high-1] — same as T(n) = T(n-1) + n → O(n²) worst case.'
  }
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let QUESTIONS = [], qIdx = 0, score = 0, answered = false, selectedMulti = new Set();

function initQuiz() {
  QUESTIONS = shuffle(ALL_QUESTIONS).slice(0, 15);
  qIdx = 0; score = 0; answered = false; selectedMulti = new Set();
}

function renderQuestion() {
  const q = QUESTIONS[qIdx];
  const isMulti = q.type === 'multi';
  const container = document.getElementById('quiz-container');
  container.innerHTML = `
    <div class="quiz-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--accent5);text-transform:uppercase;letter-spacing:1px">${q.layer}</div>
        ${isMulti ? `<div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--accent4);background:rgba(255,166,87,0.12);border:1px solid rgba(255,166,87,0.3);padding:2px 8px;border-radius:20px">SELECT ALL THAT APPLY</div>` : ''}
      </div>
      <div class="quiz-question">${q.q}</div>
      <div class="quiz-options" id="quiz-opts">
        ${q.opts.map((o, i) => `
          <div class="quiz-opt ${isMulti ? 'multi-opt' : ''}" id="opt-${i}" onclick="${isMulti ? `toggleMulti(${i})` : `selectAnswer(${i})`}">
            <span style="display:inline-flex;align-items:center;gap:8px">
              ${isMulti ? `<span id="chk-${i}" style="width:16px;height:16px;border-radius:3px;border:2px solid var(--border);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px"></span>` : ''}
              ${o}
            </span>
          </div>`).join('')}
      </div>
      ${isMulti ? `<div style="margin-top:12px;text-align:right"><button class="btn btn-primary" id="submit-multi-btn" onclick="submitMulti()" style="padding:6px 16px;font-size:0.82rem">Submit Answer</button></div>` : ''}
      <div class="quiz-feedback" id="quiz-fb"></div>
    </div>
  `;
  document.getElementById('quiz-progress-label').textContent = `Question ${qIdx + 1} / ${QUESTIONS.length}`;
  document.getElementById('quiz-score-label').textContent = `Score: ${score}`;
  document.getElementById('quiz-progress-bar').style.width = ((qIdx + 1) / QUESTIONS.length * 100) + '%';
  answered = false; selectedMulti = new Set();
}

function toggleMulti(i) {
  if (answered) return;
  if (selectedMulti.has(i)) selectedMulti.delete(i);
  else selectedMulti.add(i);
  // update checkboxes
  QUESTIONS[qIdx].opts.forEach((_, idx) => {
    const chk = document.getElementById('chk-' + idx);
    const opt = document.getElementById('opt-' + idx);
    if (chk) {
      const sel = selectedMulti.has(idx);
      chk.textContent = sel ? '✓' : '';
      chk.style.background = sel ? 'var(--accent)' : 'transparent';
      chk.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
      opt.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
      opt.style.color = sel ? 'var(--text)' : '';
    }
  });
}

function submitMulti() {
  if (answered || selectedMulti.size === 0) return;
  answered = true;
  const q = QUESTIONS[qIdx];
  const correctSet = new Set(q.correct);
  const isCorrect = selectedMulti.size === correctSet.size && [...selectedMulti].every(i => correctSet.has(i));
  if (isCorrect) score++;

  document.getElementById('submit-multi-btn').disabled = true;
  q.opts.forEach((_, idx) => {
    const opt = document.getElementById('opt-' + idx);
    const chk = document.getElementById('chk-' + idx);
    opt.style.cursor = 'default';
    if (correctSet.has(idx)) { opt.classList.add('correct'); if(chk){chk.textContent='✓';chk.style.background='var(--accent3)';chk.style.borderColor='var(--accent3)';} }
    else if (selectedMulti.has(idx)) { opt.classList.add('wrong'); if(chk){chk.textContent='✗';chk.style.background='var(--accent2)';chk.style.borderColor='var(--accent2)';} }
  });
  const fb = document.getElementById('quiz-fb');
  fb.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'wrong');
  fb.style.display = 'block';
  fb.textContent = (isCorrect ? '✓ Correct! ' : '✗ Incorrect. ') + q.explain;
  document.getElementById('quiz-score-label').textContent = `Score: ${score}`;
}

function selectAnswer(i) {
  if (answered) return;
  answered = true;
  const q = QUESTIONS[qIdx];
  const opts = document.querySelectorAll('.quiz-opt');
  const fb = document.getElementById('quiz-fb');
  opts.forEach((o, idx) => {
    o.style.cursor = 'default';
    if (q.correct.includes(idx)) o.classList.add('correct');
    else if (idx === i) o.classList.add('wrong');
  });
  const isCorrect = q.correct.includes(i);
  if (isCorrect) score++;
  fb.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'wrong');
  fb.style.display = 'block';
  fb.textContent = (isCorrect ? '✓ Correct! ' : '✗ Incorrect. ') + q.explain;
  document.getElementById('quiz-score-label').textContent = `Score: ${score}`;
}

function nextQuestion() {
  if (!answered && QUESTIONS[qIdx]?.type === 'single') return;
  if (qIdx < QUESTIONS.length - 1) { qIdx++; renderQuestion(); }
  else {
    const pct = Math.round(score / QUESTIONS.length * 100);
    document.getElementById('quiz-container').innerHTML = `
      <div class="quiz-box" style="text-align:center;padding:32px">
        <div style="font-size:2.5rem;margin-bottom:12px">${pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}</div>
        <div style="font-size:1.2rem;font-weight:600;color:var(--text);margin-bottom:8px">Quiz Complete!</div>
        <div style="color:var(--muted);margin-bottom:6px">Score: <strong style="color:var(--accent);font-size:1.5rem">${score}</strong> / ${QUESTIONS.length} &nbsp;•&nbsp; <strong style="color:${pct>=80?'var(--accent3)':pct>=60?'var(--accent4)':'var(--accent2)'}">${pct}%</strong></div>
        <div style="color:var(--muted);font-size:0.88rem;margin-top:12px;max-width:480px;margin-left:auto;margin-right:auto">${pct >= 80 ? 'Excellent! You can handle Layer 4-5 depth questions — you\'re ready to teach!' : pct >= 60 ? 'Good foundation. Review the correctness and comparison tabs to reach Layer 4-5.' : 'Review the algorithm tabs carefully. Focus on the "why" behind each complexity claim.'}</div>
      </div>`;
    document.getElementById('quiz-progress-label').textContent = `Complete`;
    document.getElementById('quiz-progress-bar').style.width = '100%';
  }
}

function resetQuiz() { initQuiz(); renderQuestion(); }
initQuiz(); renderQuestion();