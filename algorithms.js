// algorithms.js
// Pre-compute step-by-step snapshots for Dijkstra's and Prim's algorithms
// on the fixed CS2420 example graph. Each step is a complete state snapshot
// so the UI can step forward/back by simple array index.

// ---------------------------------------------------------------------------
// Graph: 5-node example (A, B, C, D, E)
//   A-B(4), A-C(2), B-C(3), B-D(5), C-E(1), D-E(3)
// ---------------------------------------------------------------------------
const GRAPH = {
  nodes: {
    // Positions roughly mirror the real Weber State Ogden campus layout:
    // Noorda up top, Tracy Hall + Eng Tech in the middle row, Stewart
    // Library + Marriott Allied Health on the bottom row.
    A: { x: 440, y: 80,  building: 'Noorda' },
    B: { x: 420, y: 230, building: 'Engineering Tech' },
    C: { x: 180, y: 220, building: 'Tracy Hall' },
    D: { x: 420, y: 370, building: 'Marriott Allied Health' },
    E: { x: 180, y: 370, building: 'Stewart Library (Book Museum)' }
  },
  edges: [
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 2 },
    { from: 'B', to: 'C', weight: 3 },
    { from: 'B', to: 'D', weight: 1 },
    { from: 'C', to: 'E', weight: 1 },
    { from: 'D', to: 'E', weight: 4 }
  ]
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function edgeKey(u, v) {
  return [u, v].sort().join('-');
}

function getNeighbors(graph, u) {
  const result = [];
  for (const e of graph.edges) {
    if (e.from === u) result.push({ to: e.to, weight: e.weight });
    else if (e.to === u) result.push({ to: e.from, weight: e.weight });
  }
  return result;
}

function initEdgeStates(graph) {
  const es = {};
  graph.edges.forEach(e => { es[edgeKey(e.from, e.to)] = 'inactive'; });
  return es;
}

// ---------------------------------------------------------------------------
// Dijkstra's Algorithm
// ---------------------------------------------------------------------------
function buildDijkstraSteps(graph, sourceName = 'A') {
  const steps = [];
  const nodes = Object.keys(graph.nodes);
  const dist = {};
  const nodeStates = {};
  const edgeStates = initEdgeStates(graph);
  const parent = {};

  nodes.forEach(n => {
    dist[n] = Infinity;
    nodeStates[n] = 'unvisited';
  });
  dist[sourceName] = 0;
  nodeStates[sourceName] = 'in-heap';
  parent[sourceName] = null;

  // Lazy min-heap: array sorted on each pop
  const heap = [{ key: 0, label: sourceName }];

  // Step 0: initialization
  steps.push({
    title: 'Initialize',
    details: [
      `dist[${sourceName}] = 0, all others = \u221e`,
      `Push {0, ${sourceName}} into the min-heap`
    ],
    nodeStates: { ...nodeStates },
    edgeStates: { ...edgeStates },
    heap: annotateDijkstraHeap(heap, dist),
    dist: { ...dist },
    parent: { ...parent },
    stepNumber: 0,
    isStale: false,
    isDone: false
  });

  let stepNum = 1;

  while (heap.length > 0) {
    heap.sort((a, b) => a.key - b.key);

    // STEP: "Select smallest" — peek at the top, highlight it, don't pop yet
    const top = heap[0];
    const selectedHeap = annotateDijkstraHeap(heap, dist);
    if (selectedHeap.length > 0) selectedHeap[0].isSelected = true;
    steps.push({
      title: `Next up: {${top.key}, ${top.label}}`,
      details: [
        `{${top.key}, ${top.label}} has the smallest key in the min-heap`,
        `Pop it next to process vertex ${top.label}`
      ],
      nodeStates: { ...nodeStates },
      edgeStates: { ...edgeStates },
      heap: selectedHeap,
      dist: { ...dist },
      parent: { ...parent },
      stepNumber: stepNum++,
      isStale: false,
      isDone: false
    });

    const popped = heap.shift();
    const u = popped.label;
    const popDist = popped.key;

    // Stale-entry check
    if (popDist > dist[u]) {
      steps.push({
        title: `Pop {${popDist}, ${u}}`,
        details: [
          `Stale entry: dist[${u}] = ${dist[u]} < ${popDist}`,
          `Skip (this path was already beaten by an earlier pop)`
        ],
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates },
        heap: annotateDijkstraHeap(heap, dist),
        dist: { ...dist },
        parent: { ...parent },
        stepNumber: stepNum++,
        isStale: true,
        isDone: false,
        poppedEntry: { ...popped }
      });
      continue;
    }

    // Finalize u
    nodeStates[u] = 'finalized';
    if (parent[u] !== null && parent[u] !== undefined) {
      edgeStates[edgeKey(parent[u], u)] = 'confirmed';
    }

    // Compute checks (read-only pass) and collect pending updates
    const checkDetails = [];
    const pendingUpdates = [];
    for (const { to: v, weight: w } of getNeighbors(graph, u)) {
      const candidate = dist[u] + w;
      const current = dist[v];
      const currentStr = current === Infinity ? '\u221e' : current;
      const isReplacement = current !== Infinity && candidate < current;

      if (candidate < current) {
        pendingUpdates.push({ v, candidate, w, previous: current, isReplacement });
        if (isReplacement) {
          checkDetails.push(`${v}: ${dist[u]}+${w}=${candidate} < ${currentStr} \u2192 REPLACE dist[${v}] (was ${currentStr})`);
        } else {
          checkDetails.push(`${v}: ${dist[u]}+${w}=${candidate} < ${currentStr} \u2192 will update dist[${v}]`);
        }
      } else {
        checkDetails.push(`${v}: ${dist[u]}+${w}=${candidate} \u2265 ${currentStr}, skip`);
      }
    }

    // STEP A: "Check" — u finalized and its parent edge confirmed, but dist / heap / tentative edges unchanged
    steps.push({
      title: `Pop {${popDist}, ${u}} \u2014 ${u} is finalized`,
      details: checkDetails.length > 0 ? checkDetails : ['(no neighbors to check)'],
      nodeStates: { ...nodeStates },
      edgeStates: { ...edgeStates },
      heap: annotateDijkstraHeap(heap, dist),
      dist: { ...dist },
      parent: { ...parent },
      stepNumber: stepNum++,
      isStale: false,
      isDone: false,
      poppedEntry: { ...popped }
    });

    // STEP B: "Commit" — apply pending updates (only if any improvements happened)
    if (pendingUpdates.length > 0) {
      const commitDetails = [];
      const highlightedRows = [];
      const replacedRows = [];
      for (const { v, candidate, w, previous, isReplacement } of pendingUpdates) {
        // Demote any previously-tentative edge from an older parent
        if (parent[v] !== undefined && parent[v] !== null) {
          const oldKey = edgeKey(parent[v], v);
          if (edgeStates[oldKey] === 'tentative') {
            edgeStates[oldKey] = 'inactive';
          }
        }
        dist[v] = candidate;
        parent[v] = u;
        if (nodeStates[v] === 'unvisited') nodeStates[v] = 'in-heap';
        edgeStates[edgeKey(u, v)] = 'tentative';
        heap.push({ key: dist[v], label: v });
        if (isReplacement) {
          commitDetails.push(`dist[${v}]: ${previous} \u2192 ${candidate} (replaced!) \u00a0 push {${candidate}, ${v}} into the min-heap`);
          replacedRows.push(v);
        } else {
          commitDetails.push(`dist[${v}] = ${candidate} \u00a0 push {${candidate}, ${v}} into the min-heap`);
        }
        highlightedRows.push(v);
      }

      steps.push({
        title: `Commit updates to dist[] and the min-heap`,
        details: commitDetails,
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates },
        heap: annotateDijkstraHeap(heap, dist),
        dist: { ...dist },
        parent: { ...parent },
        stepNumber: stepNum++,
        isStale: false,
        isDone: false,
        highlightedRows,
        replacedRows
      });
    }
  }

  // Final "done" step
  const summary = nodes
    .filter(n => n !== sourceName)
    .map(n => `${n}=${dist[n]}`)
    .join(', ');
  steps.push({
    title: 'Heap empty \u2014 done!',
    details: [`Shortest distances from ${sourceName}: ${summary}`],
    nodeStates: { ...nodeStates },
    edgeStates: { ...edgeStates },
    heap: [],
    dist: { ...dist },
    parent: { ...parent },
    stepNumber: stepNum++,
    isStale: false,
    isDone: true
  });

  return steps;
}

function annotateDijkstraHeap(heap, dist) {
  return [...heap]
    .sort((a, b) => a.key - b.key)
    .map(h => ({ ...h, isStale: h.key > dist[h.label] }));
}

// ---------------------------------------------------------------------------
// Prim's Algorithm
// ---------------------------------------------------------------------------
function buildPrimSteps(graph, startName = 'A') {
  const steps = [];
  const nodes = Object.keys(graph.nodes);
  const nodeStates = {};
  const edgeStates = initEdgeStates(graph);
  const mstSet = new Set();
  let totalWeight = 0;
  const heap = [];
  // Track which existing-MST vertex brought each newly-added vertex into the tree.
  // primParent[v] = { from: <existing vertex>, weight: <edge weight> }
  const primParent = {};

  nodes.forEach(n => { nodeStates[n] = 'unvisited'; });

  // Initialize: add start, push its edges
  mstSet.add(startName);
  nodeStates[startName] = 'in-mst';
  primParent[startName] = null;
  const initDetails = [`Add ${startName} to MST`];
  for (const { to, weight } of getNeighbors(graph, startName)) {
    heap.push({ key: weight, label: `${startName}-${to}`, from: startName, to });
    edgeStates[edgeKey(startName, to)] = 'candidate';
    initDetails.push(`Push {${weight}, ${startName}-${to}} into the min-heap`);
  }

  steps.push({
    title: 'Initialize',
    details: initDetails,
    nodeStates: { ...nodeStates },
    edgeStates: { ...edgeStates },
    heap: annotatePrimHeap(heap, mstSet),
    mstSet: [...mstSet],
    primParent: { ...primParent },
    totalWeight,
    stepNumber: 0,
    isStale: false,
    isDone: false
  });

  let stepNum = 1;

  while (heap.length > 0 && mstSet.size < nodes.length) {
    heap.sort((a, b) => a.key - b.key);

    // STEP: "Select cheapest edge" — peek and highlight, don't pop yet
    const top = heap[0];
    const selectedHeap = annotatePrimHeap(heap, mstSet);
    if (selectedHeap.length > 0) selectedHeap[0].isSelected = true;
    steps.push({
      title: `Next up: {${top.key}, ${top.label}}`,
      details: [
        `{${top.key}, ${top.label}} has the smallest weight in the min-heap`,
        `Pop it next to try adding it to the MST`
      ],
      nodeStates: { ...nodeStates },
      edgeStates: { ...edgeStates },
      heap: selectedHeap,
      mstSet: [...mstSet],
      primParent: { ...primParent },
      totalWeight,
      stepNumber: stepNum++,
      isStale: false,
      isDone: false
    });

    const edge = heap.shift();

    // Stale check: both endpoints already in MST → cycle
    if (mstSet.has(edge.from) && mstSet.has(edge.to)) {
      steps.push({
        title: `Pop {${edge.key}, ${edge.label}}`,
        details: [
          `Both ${edge.from} and ${edge.to} are already in the MST`,
          `Skip (adding this edge would form a cycle)`
        ],
        nodeStates: { ...nodeStates },
        edgeStates: { ...edgeStates },
        heap: annotatePrimHeap(heap, mstSet),
        mstSet: [...mstSet],
        primParent: { ...primParent },
        totalWeight,
        stepNumber: stepNum++,
        isStale: true,
        isDone: false,
        poppedEntry: { ...edge }
      });
      continue;
    }

    // Accept: determine which endpoint is newly added
    const existingVertex = mstSet.has(edge.from) ? edge.from : edge.to;
    const newVertex = mstSet.has(edge.from) ? edge.to : edge.from;
    mstSet.add(newVertex);
    nodeStates[newVertex] = 'in-mst';
    edgeStates[edgeKey(edge.from, edge.to)] = 'in-mst';
    totalWeight += edge.key;
    primParent[newVertex] = { from: existingVertex, weight: edge.key };

    const details = [
      `Accept: add edge ${edge.from}\u2013${edge.to}(${edge.key}) to the MST`,
      `Add ${newVertex} to the MST set`
    ];

    // Push new vertex's edges to vertices not yet in MST
    for (const { to, weight } of getNeighbors(graph, newVertex)) {
      if (!mstSet.has(to)) {
        heap.push({ key: weight, label: `${newVertex}-${to}`, from: newVertex, to });
        if (edgeStates[edgeKey(newVertex, to)] !== 'in-mst') {
          edgeStates[edgeKey(newVertex, to)] = 'candidate';
        }
        details.push(`Push {${weight}, ${newVertex}-${to}} into the min-heap`);
      }
    }

    // If that completes the MST, clean up remaining candidate edges so the
    // snapshot shows the final tree cleanly.
    const mstComplete = mstSet.size === nodes.length;
    if (mstComplete) {
      for (const e of graph.edges) {
        const k = edgeKey(e.from, e.to);
        if (edgeStates[k] === 'candidate') edgeStates[k] = 'inactive';
      }
      heap.length = 0;
      details.push('MST has all V vertices \u2014 MST complete!');
    }

    steps.push({
      title: `Pop {${edge.key}, ${edge.label}}`,
      details,
      nodeStates: { ...nodeStates },
      edgeStates: { ...edgeStates },
      heap: annotatePrimHeap(heap, mstSet),
      mstSet: [...mstSet],
      primParent: { ...primParent },
      totalWeight,
      stepNumber: stepNum++,
      isStale: false,
      isDone: false,
      poppedEntry: { ...edge }
    });
  }

  // Final "done" step
  const treeEdges = graph.edges
    .filter(e => edgeStates[edgeKey(e.from, e.to)] === 'in-mst')
    .map(e => `${e.from}\u2013${e.to}(${e.weight})`);

  steps.push({
    title: 'Done!',
    details: [
      `MST edges: ${treeEdges.join(', ')}`,
      `Total weight = ${totalWeight}`
    ],
    nodeStates: { ...nodeStates },
    edgeStates: { ...edgeStates },
    heap: [],
    mstSet: [...mstSet],
    primParent: { ...primParent },
    totalWeight,
    stepNumber: stepNum++,
    isStale: false,
    isDone: true
  });

  return steps;
}

function annotatePrimHeap(heap, mstSet) {
  return [...heap]
    .sort((a, b) => a.key - b.key)
    .map(h => ({ ...h, isStale: mstSet.has(h.from) && mstSet.has(h.to) }));
}
