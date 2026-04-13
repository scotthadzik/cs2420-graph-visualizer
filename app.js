// app.js
// State management, SVG rendering, and UI wiring for the CS 2420
// Dijkstra's / Prim's visualizer.

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_R = 28;

// Pre-compute steps for both algorithms (graph is fixed).
const DIJKSTRA_STEPS = buildDijkstraSteps(GRAPH, 'A');
const PRIM_STEPS = buildPrimSteps(GRAPH, 'A');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  algorithm: 'dijkstra',
  steps: DIJKSTRA_STEPS,
  currentStep: 0,
  isPlaying: false,
  playIntervalId: null,
  speed: 5
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const svgRoot = document.getElementById('graph-svg');
const edgeGroup = document.getElementById('edges');
const edgeLabelGroup = document.getElementById('edge-labels');
const nodeGroup = document.getElementById('nodes');

const stepDescEl = document.getElementById('step-description');
const stepNumEl = document.getElementById('step-num');
const stepTotalEl = document.getElementById('step-total');
const heapListEl = document.getElementById('heap-list');
const heapNoteEl = document.getElementById('heap-note');
const stateTitleEl = document.getElementById('state-title');
const stateContentEl = document.getElementById('state-content');
const pathSectionEl = document.getElementById('path-section');
const pathTitleEl = document.getElementById('path-title');
const pathListEl = document.getElementById('path-list');

const btnAlgoDijkstra = document.getElementById('algo-dijkstra');
const btnAlgoPrims = document.getElementById('algo-prims');
const btnAlgoCompare = document.getElementById('algo-compare');
const btnReset = document.getElementById('btn-reset');
const btnBack = document.getElementById('btn-back');
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const speedSlider = document.getElementById('speed-slider');

const mainViewEl = document.getElementById('main-view');
const compareViewEl = document.getElementById('compare-view');
const footerControlsEl = document.getElementById('footer-controls');

// Keep references to SVG elements by key so we can re-color them fast.
const nodeRefs = {};  // key -> { circle, label, distLabel }
const edgeRefs = {};  // key -> { line, labelRect, labelText }

// ---------------------------------------------------------------------------
// Graph skeleton (run once on load)
// ---------------------------------------------------------------------------
function buildGraphSkeleton() {
  // Edges first (below nodes)
  for (const e of GRAPH.edges) {
    const key = edgeKey(e.from, e.to);
    const { x1, y1, x2, y2 } = computeEdgeEndpoints(e.from, e.to);

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'edge');
    g.setAttribute('data-key', key);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    g.appendChild(line);
    edgeGroup.appendChild(g);

    // Weight label group (positioned at edge midpoint)
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const labelGroup = document.createElementNS(SVG_NS, 'g');
    labelGroup.setAttribute('class', 'edge-label');
    labelGroup.setAttribute('data-key', key);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', mx - 13);
    rect.setAttribute('y', my - 10);
    rect.setAttribute('width', 26);
    rect.setAttribute('height', 20);
    rect.setAttribute('rx', 10);
    labelGroup.appendChild(rect);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', mx);
    text.setAttribute('y', my + 5);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = e.weight;
    labelGroup.appendChild(text);

    edgeLabelGroup.appendChild(labelGroup);

    edgeRefs[key] = { line, labelRect: rect, labelText: text };
  }

  // Nodes
  for (const [name, pos] of Object.entries(GRAPH.nodes)) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('data-name', name);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', NODE_R);
    circle.setAttribute('stroke-width', 2.5);
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y + 6);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = name;
    g.appendChild(label);

    // Building label (above the circle, if any)
    if (pos.building) {
      const buildingLabel = document.createElementNS(SVG_NS, 'text');
      buildingLabel.setAttribute('class', 'building-label');
      buildingLabel.setAttribute('text-anchor', 'middle');
      buildingLabel.setAttribute('x', pos.x);
      buildingLabel.setAttribute('y', pos.y - NODE_R - 6);
      buildingLabel.textContent = pos.building;
      g.appendChild(buildingLabel);
    }

    // Dist / status label positioned below the circle
    const distLabel = document.createElementNS(SVG_NS, 'text');
    distLabel.setAttribute('class', 'dist-label');
    distLabel.setAttribute('text-anchor', 'middle');
    distLabel.setAttribute('x', pos.x);
    distLabel.setAttribute('y', pos.y + NODE_R + 16);
    g.appendChild(distLabel);

    nodeGroup.appendChild(g);
    nodeRefs[name] = { circle, label, distLabel };
  }
}

function computeEdgeEndpoints(u, v) {
  const a = GRAPH.nodes[u];
  const b = GRAPH.nodes[v];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: a.x + NODE_R * ux,
    y1: a.y + NODE_R * uy,
    x2: b.x - NODE_R * ux,
    y2: b.y - NODE_R * uy
  };
}

// ---------------------------------------------------------------------------
// Node / edge state styling
// ---------------------------------------------------------------------------
const NODE_STYLE = {
  unvisited:  { fill: '#f0f0f0', stroke: '#bdc3c7', textFill: '#999' },
  'in-heap':  { fill: '#ffffff', stroke: '#2980b9', textFill: '#2c3e50' },
  finalized:  { fill: '#eafaf1', stroke: '#27ae60', textFill: '#2c3e50' },
  'in-mst':   { fill: '#eafaf1', stroke: '#27ae60', textFill: '#2c3e50' }
};

const EDGE_STYLE = {
  inactive:  { stroke: '#e0e0e0', width: 1.5, dash: 'none',   rectFill: '#ffffff', rectStroke: '#bdc3c7', textFill: '#999' },
  tentative: { stroke: '#2980b9', width: 2,   dash: '5,4',    rectFill: '#eaf2f8', rectStroke: '#2980b9', textFill: '#2980b9' },
  confirmed: { stroke: '#27ae60', width: 4,   dash: 'none',   rectFill: '#eafaf1', rectStroke: '#27ae60', textFill: '#27ae60' },
  candidate: { stroke: '#e67e22', width: 2,   dash: '5,4',    rectFill: '#fff3e0', rectStroke: '#e67e22', textFill: '#e67e22' },
  'in-mst':  { stroke: '#27ae60', width: 4,   dash: 'none',   rectFill: '#eafaf1', rectStroke: '#27ae60', textFill: '#27ae60' }
};

function applyNodeState(name, nodeState, snapshot) {
  const refs = nodeRefs[name];
  const style = NODE_STYLE[nodeState] || NODE_STYLE.unvisited;
  refs.circle.setAttribute('fill', style.fill);
  refs.circle.setAttribute('stroke', style.stroke);
  refs.label.setAttribute('fill', style.textFill);

  // Dist / status label content
  let labelText = '';
  let labelColor = '#777';
  if (state.algorithm === 'dijkstra') {
    const d = snapshot.dist[name];
    if (d === Infinity) {
      labelText = '\u221e';
      labelColor = '#bdc3c7';
    } else {
      labelText = 'dist = ' + d;
      labelColor = nodeState === 'finalized' ? '#27ae60' : '#2980b9';
    }
  } else {
    // Prim's
    if (name === 'A') {
      labelText = 'start';
      labelColor = '#e67e22';
    } else if (nodeState === 'in-mst') {
      labelText = 'in MST';
      labelColor = '#27ae60';
    } else {
      labelText = '';
    }
  }
  refs.distLabel.textContent = labelText;
  refs.distLabel.setAttribute('fill', labelColor);
}

function applyEdgeState(key, edgeState) {
  const refs = edgeRefs[key];
  const style = EDGE_STYLE[edgeState] || EDGE_STYLE.inactive;
  refs.line.setAttribute('stroke', style.stroke);
  refs.line.setAttribute('stroke-width', style.width);
  refs.line.setAttribute('stroke-dasharray', style.dash);
  refs.labelRect.setAttribute('fill', style.rectFill);
  refs.labelRect.setAttribute('stroke', style.rectStroke);
  refs.labelText.setAttribute('fill', style.textFill);
}

// ---------------------------------------------------------------------------
// Render a single step snapshot
// ---------------------------------------------------------------------------
function renderStep() {
  const snapshot = state.steps[state.currentStep];

  // Graph
  for (const name of Object.keys(GRAPH.nodes)) {
    applyNodeState(name, snapshot.nodeStates[name], snapshot);
  }
  for (const e of GRAPH.edges) {
    const k = edgeKey(e.from, e.to);
    applyEdgeState(k, snapshot.edgeStates[k]);
  }

  // Step description (title headline + details as bullet list)
  stepDescEl.innerHTML = '';
  stepDescEl.className = 'step-description';
  if (snapshot.isStale) stepDescEl.classList.add('stale');
  if (snapshot.isDone) stepDescEl.classList.add('done');

  const titleEl = document.createElement('div');
  titleEl.className = 'step-title';
  titleEl.textContent = snapshot.title;
  stepDescEl.appendChild(titleEl);

  if (snapshot.details && snapshot.details.length > 0) {
    const list = document.createElement('ul');
    list.className = 'step-details';
    for (const d of snapshot.details) {
      const li = document.createElement('li');
      li.textContent = d;
      list.appendChild(li);
    }
    stepDescEl.appendChild(list);
  }

  // Step counter
  stepNumEl.textContent = snapshot.stepNumber;
  stepTotalEl.textContent = state.steps[state.steps.length - 1].stepNumber;

  // Heap panel
  renderHeap(snapshot);

  // State panel (dist[] for Dijkstra, MST set / total for Prim's)
  renderStatePanel(snapshot);

  // Path reconstruction panel (Dijkstra only)
  renderPathList(snapshot);

  // Button enabled states
  btnBack.disabled = state.currentStep === 0;
  btnStep.disabled = state.currentStep >= state.steps.length - 1;
}

function renderHeap(snapshot) {
  heapListEl.innerHTML = '';
  heapNoteEl.textContent = snapshot.heap.length > 0
    ? `(${snapshot.heap.length} ${snapshot.heap.length === 1 ? 'entry' : 'entries'})`
    : '';

  if (snapshot.heap.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '(empty)';
    heapListEl.appendChild(li);
    return;
  }

  for (const entry of snapshot.heap) {
    const li = document.createElement('li');
    if (entry.isStale) li.classList.add('stale');
    if (entry.isSelected) li.classList.add('selected');
    li.textContent = `{${entry.key}, ${entry.label}}`;
    heapListEl.appendChild(li);
  }
}

function renderStatePanel(snapshot) {
  if (state.algorithm === 'dijkstra') {
    stateTitleEl.textContent = 'dist[]';
    stateContentEl.innerHTML = '';
    const table = document.createElement('div');
    table.className = 'dist-table';
    for (const name of Object.keys(GRAPH.nodes)) {
      const row = document.createElement('div');
      row.className = 'dist-row ' + snapshot.nodeStates[name];
      const isReplaced = snapshot.replacedRows && snapshot.replacedRows.includes(name);
      const isHighlighted = snapshot.highlightedRows && snapshot.highlightedRows.includes(name);
      if (isReplaced) {
        row.classList.add('replaced-highlight');
      } else if (isHighlighted) {
        row.classList.add('just-changed');
      }

      const labelBlock = document.createElement('div');
      labelBlock.className = 'label-block';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = name;
      labelBlock.appendChild(label);
      if (GRAPH.nodes[name].building) {
        const sub = document.createElement('span');
        sub.className = 'building-sub';
        sub.textContent = GRAPH.nodes[name].building;
        labelBlock.appendChild(sub);
      }

      const value = document.createElement('span');
      value.className = 'value';
      const d = snapshot.dist[name];
      value.textContent = d === Infinity ? '\u221e' : d;

      row.appendChild(labelBlock);
      row.appendChild(value);
      table.appendChild(row);
    }
    stateContentEl.appendChild(table);
  } else {
    // Prim's
    stateTitleEl.textContent = 'MST set';
    stateContentEl.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'mst-list';
    list.textContent = '{ ' + snapshot.mstSet.join(', ') + ' }';
    stateContentEl.appendChild(list);

    const total = document.createElement('div');
    total.className = 'mst-total';
    total.textContent = 'Total weight = ' + snapshot.totalWeight;
    stateContentEl.appendChild(total);
  }
}

// ---------------------------------------------------------------------------
// Control handlers
// ---------------------------------------------------------------------------
function setAlgorithm(algo) {
  if (state.algorithm === algo) return;
  stopPlaying();
  state.algorithm = algo;
  btnAlgoDijkstra.classList.toggle('active', algo === 'dijkstra');
  btnAlgoPrims.classList.toggle('active', algo === 'prims');
  btnAlgoCompare.classList.toggle('active', algo === 'compare');

  if (algo === 'compare') {
    mainViewEl.style.display = 'none';
    footerControlsEl.style.display = 'none';
    compareViewEl.style.display = '';
    return;
  }

  // Stepping view: show main + footer, hide compare
  mainViewEl.style.display = '';
  footerControlsEl.style.display = '';
  compareViewEl.style.display = 'none';
  state.steps = algo === 'dijkstra' ? DIJKSTRA_STEPS : PRIM_STEPS;
  state.currentStep = 0;
  renderStep();
}

function stepForward() {
  if (state.currentStep < state.steps.length - 1) {
    state.currentStep++;
    renderStep();
  } else {
    stopPlaying();
  }
}

function stepBack() {
  if (state.currentStep > 0) {
    state.currentStep--;
    renderStep();
  }
}

function reset() {
  stopPlaying();
  state.currentStep = 0;
  renderStep();
}

function togglePlay() {
  if (state.isPlaying) {
    stopPlaying();
  } else {
    startPlaying();
  }
}

function startPlaying() {
  if (state.currentStep >= state.steps.length - 1) {
    state.currentStep = 0;
    renderStep();
  }
  state.isPlaying = true;
  btnPlay.classList.add('playing');
  btnPlay.innerHTML = '&#x23F8; Pause';
  scheduleNextTick();
}

function stopPlaying() {
  state.isPlaying = false;
  btnPlay.classList.remove('playing');
  btnPlay.innerHTML = '&#x25B6; Play';
  if (state.playIntervalId !== null) {
    clearTimeout(state.playIntervalId);
    state.playIntervalId = null;
  }
}

function scheduleNextTick() {
  // Slider 1..10 → delay 1800..200 ms
  const delay = 2000 - state.speed * 180;
  state.playIntervalId = setTimeout(() => {
    stepForward();
    if (state.isPlaying && state.currentStep < state.steps.length - 1) {
      scheduleNextTick();
    } else {
      stopPlaying();
    }
  }, delay);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
btnAlgoDijkstra.addEventListener('click', () => setAlgorithm('dijkstra'));
btnAlgoPrims.addEventListener('click', () => setAlgorithm('prims'));
btnAlgoCompare.addEventListener('click', () => setAlgorithm('compare'));
btnReset.addEventListener('click', reset);
btnBack.addEventListener('click', () => { stopPlaying(); stepBack(); });
btnStep.addEventListener('click', () => { stopPlaying(); stepForward(); });
btnPlay.addEventListener('click', togglePlay);
speedSlider.addEventListener('input', (e) => {
  state.speed = parseInt(e.target.value, 10);
});

// Keyboard shortcuts: left / right arrows, space = play/pause
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') { stopPlaying(); stepForward(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { stopPlaying(); stepBack(); e.preventDefault(); }
  else if (e.key === ' ') { togglePlay(); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') { reset(); e.preventDefault(); }
});

// ---------------------------------------------------------------------------
// Path reconstruction (Dijkstra only)
// ---------------------------------------------------------------------------
const SOURCE_NAME = 'A';

function reconstructPath(parent, target) {
  if (target === SOURCE_NAME) return [SOURCE_NAME];
  if (!parent || parent[target] === undefined || parent[target] === null) return null;
  const path = [target];
  let cur = parent[target];
  while (cur !== null && cur !== undefined) {
    path.unshift(cur);
    cur = parent[cur];
  }
  return path;
}

function displayName(name) {
  // Prefer building name if present; fall back to the letter
  const building = GRAPH.nodes[name] && GRAPH.nodes[name].building;
  return building || name;
}

function renderPathList(snapshot) {
  pathSectionEl.style.display = '';
  pathListEl.innerHTML = '';

  if (state.algorithm === 'dijkstra') {
    pathTitleEl.textContent = 'paths from source';
    renderDijkstraPaths(snapshot);
  } else if (state.algorithm === 'prims') {
    pathTitleEl.textContent = 'MST build order';
    renderPrimBuildOrder(snapshot);
  } else {
    pathSectionEl.style.display = 'none';
  }
}

function renderDijkstraPaths(snapshot) {
  const parent = snapshot.parent || {};
  const dist = snapshot.dist;

  for (const name of Object.keys(GRAPH.nodes)) {
    const li = document.createElement('li');
    const nodeState = snapshot.nodeStates[name];

    if (name === SOURCE_NAME) {
      li.className = 'source';
      li.innerHTML = `<span class="path-dest">${displayName(name)}</span><span class="path-cost">0</span><span class="path-route">(source)</span>`;
      pathListEl.appendChild(li);
      continue;
    }

    li.className = nodeState;
    const d = dist[name];
    if (d === Infinity) {
      li.innerHTML = `<span class="path-dest">${displayName(name)}</span><span class="path-cost">\u221e</span><span class="path-route">(not yet reached)</span>`;
      pathListEl.appendChild(li);
      continue;
    }

    const path = reconstructPath(parent, name);
    const routeStr = path
      ? path.map(displayName).join('  \u2192  ')
      : '(not yet reached)';
    li.innerHTML =
      `<span class="path-dest">${displayName(name)}</span>` +
      `<span class="path-cost">${d}</span>` +
      `<span class="path-route">${routeStr}</span>`;
    pathListEl.appendChild(li);
  }
}

function renderPrimBuildOrder(snapshot) {
  const primParent = snapshot.primParent || {};
  const mstSet = new Set(snapshot.mstSet || []);

  for (const name of Object.keys(GRAPH.nodes)) {
    const li = document.createElement('li');

    if (name === SOURCE_NAME) {
      li.className = 'source';
      li.innerHTML =
        `<span class="path-dest">${displayName(name)}</span>` +
        `<span class="path-cost">0</span>` +
        `<span class="path-route">(start)</span>`;
      pathListEl.appendChild(li);
      continue;
    }

    if (!mstSet.has(name)) {
      li.className = 'unvisited';
      li.innerHTML =
        `<span class="path-dest">${displayName(name)}</span>` +
        `<span class="path-cost">\u2014</span>` +
        `<span class="path-route">(not yet added)</span>`;
      pathListEl.appendChild(li);
      continue;
    }

    // Vertex is in MST — show the edge that added it
    const p = primParent[name];
    li.className = 'finalized';
    if (p && p.from) {
      li.innerHTML =
        `<span class="path-dest">${displayName(name)}</span>` +
        `<span class="path-cost">+${p.weight}</span>` +
        `<span class="path-route">${displayName(p.from)}  \u2192  ${displayName(name)}</span>`;
    } else {
      li.innerHTML =
        `<span class="path-dest">${displayName(name)}</span>` +
        `<span class="path-cost">?</span>` +
        `<span class="path-route">(added)</span>`;
    }
    pathListEl.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Adjacency list (static reference, built once)
// ---------------------------------------------------------------------------
function buildAdjacencyList() {
  const adjListEl = document.getElementById('adj-list');
  if (!adjListEl) return;

  for (const name of Object.keys(GRAPH.nodes)) {
    const neighbors = getNeighbors(GRAPH, name)
      .map(n => `(${n.to}, ${n.weight})`)
      .join(', ');
    const building = GRAPH.nodes[name].building;
    const buildingPart = building
      ? `<span class="building-sub">\u2014 ${building}</span>`
      : '';
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="vertex">"${name}"</span>` +
      buildingPart +
      `<span class="arrow">\u2192</span>` +
      `[ ${neighbors} ]`;
    adjListEl.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Compare view (static snapshot of each algorithm's final tree)
// ---------------------------------------------------------------------------
function buildCompareGraph(svg, snapshot) {
  svg.innerHTML = '';
  const edgesG = document.createElementNS(SVG_NS, 'g');
  const labelsG = document.createElementNS(SVG_NS, 'g');
  const nodesG = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(edgesG);
  svg.appendChild(labelsG);
  svg.appendChild(nodesG);

  for (const e of GRAPH.edges) {
    const key = edgeKey(e.from, e.to);
    const { x1, y1, x2, y2 } = computeEdgeEndpoints(e.from, e.to);
    const s = snapshot.edgeStates[key];
    const isTree = s === 'confirmed' || s === 'in-mst';

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', isTree ? '#27ae60' : '#bdc3c7');
    line.setAttribute('stroke-width', isTree ? 4 : 1.5);
    if (!isTree) line.setAttribute('stroke-dasharray', '5,4');
    edgesG.appendChild(line);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', mx - 13);
    rect.setAttribute('y', my - 10);
    rect.setAttribute('width', 26);
    rect.setAttribute('height', 20);
    rect.setAttribute('rx', 10);
    rect.setAttribute('fill', isTree ? '#eafaf1' : '#ffffff');
    rect.setAttribute('stroke', isTree ? '#27ae60' : '#bdc3c7');
    rect.setAttribute('stroke-width', 1.5);
    labelsG.appendChild(rect);

    const wt = document.createElementNS(SVG_NS, 'text');
    wt.setAttribute('x', mx);
    wt.setAttribute('y', my + 5);
    wt.setAttribute('text-anchor', 'middle');
    wt.setAttribute('font-size', 13);
    wt.setAttribute('font-weight', 'bold');
    wt.setAttribute('fill', isTree ? '#27ae60' : '#999');
    wt.setAttribute('font-family', "'Segoe UI', Arial, sans-serif");
    wt.textContent = e.weight;
    labelsG.appendChild(wt);
  }

  for (const [name, pos] of Object.entries(GRAPH.nodes)) {
    const isSource = name === SOURCE_NAME;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', NODE_R);
    circle.setAttribute('fill', isSource ? '#fef9e7' : '#eafaf1');
    circle.setAttribute('stroke', isSource ? '#e67e22' : '#27ae60');
    circle.setAttribute('stroke-width', 2.5);
    nodesG.appendChild(circle);

    const letter = document.createElementNS(SVG_NS, 'text');
    letter.setAttribute('x', pos.x);
    letter.setAttribute('y', pos.y + 6);
    letter.setAttribute('text-anchor', 'middle');
    letter.setAttribute('font-size', 16);
    letter.setAttribute('font-weight', 'bold');
    letter.setAttribute('fill', '#2c3e50');
    letter.setAttribute('font-family', "'Segoe UI', Arial, sans-serif");
    letter.textContent = name;
    nodesG.appendChild(letter);

    if (pos.building) {
      const bl = document.createElementNS(SVG_NS, 'text');
      bl.setAttribute('x', pos.x);
      bl.setAttribute('y', pos.y - NODE_R - 6);
      bl.setAttribute('text-anchor', 'middle');
      bl.setAttribute('font-size', 10);
      bl.setAttribute('font-weight', 600);
      bl.setAttribute('font-style', 'italic');
      bl.setAttribute('fill', '#8e44ad');
      bl.setAttribute('font-family', "'Segoe UI', Arial, sans-serif");
      bl.setAttribute('paint-order', 'stroke');
      bl.setAttribute('stroke', '#ffffff');
      bl.setAttribute('stroke-width', 3);
      bl.setAttribute('stroke-linejoin', 'round');
      bl.textContent = pos.building;
      nodesG.appendChild(bl);
    }
  }
}

// ---------------------------------------------------------------------------
// Kickoff
// ---------------------------------------------------------------------------
buildGraphSkeleton();
buildAdjacencyList();
buildCompareGraph(
  document.getElementById('compare-svg-dijkstra'),
  DIJKSTRA_STEPS[DIJKSTRA_STEPS.length - 1]
);
buildCompareGraph(
  document.getElementById('compare-svg-prims'),
  PRIM_STEPS[PRIM_STEPS.length - 1]
);
renderStep();
