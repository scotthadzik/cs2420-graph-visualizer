# CS 2420 Graph Visualizer

Interactive step-by-step visualization of **Dijkstra's shortest path** and **Prim's minimum spanning tree** algorithms for CS 2420 at Weber State University.

Live: **https://scotthadzik.github.io/cs2420-graph-visualizer/**

## What it does

- Pre-computes every step of the chosen algorithm on a fixed 5-node weighted graph.
- Lets students step forward / back, auto-play, or reset at any time.
- Shows the current state of three things at every step, synchronized:
  - The **graph** (node colors + edge highlighting)
  - The **min-heap** contents (with stale entries crossed out)
  - The **dist[] array** (Dijkstra) or **MST set + total weight** (Prim's)

Toggle between Dijkstra's and Prim's with the buttons in the header to compare them on the exact same graph.

> The static trace diagrams in the CT18 course materials use a simpler **4-node** example for introduction. This visualizer uses a slightly more complex **5-node** graph so students can practice tracing on an example they haven't seen worked out step-by-step.

## Example graph

Nodes: A, B, C, D, E

Edges:
- A&ndash;B (4)
- A&ndash;C (2)
- B&ndash;C (3)
- B&ndash;D (1)
- C&ndash;E (1)
- D&ndash;E (4)

Weights are chosen so students see:
- **A replacement** in `dist[]` during Dijkstra's run (D is first reached via E at cost 7, then replaced via B at cost 5)
- **A stale pop** near the end when the leftover `{7, D}` heap entry gets skipped
- **Different trees** between Dijkstra's (A-B + A-C + C-E + B-D = 8) and Prim's (A-C + B-C + C-E + B-D = 7), which is easy to see in the Compare tab

Source / start vertex: **A**

## Controls

| Control | Action |
|---------|--------|
| **Dijkstra's / Prim's** | Switch algorithm (resets to step 0) |
| **Reset** | Jump to step 0 |
| **&#9664; Back** | Previous step |
| **&#9654; Play / &#9208; Pause** | Auto-advance at current speed |
| **Step &#9654;** | Advance one step |
| **Speed slider** | Play speed (1 = slowest, 10 = fastest) |

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `&rarr;` | Step forward |
| `&larr;` | Step back |
| `Space` | Play / Pause |
| `R` | Reset |

## Files

```
cs2420-graph-visualizer/
├── index.html       # Page layout + inline CSS
├── algorithms.js    # Graph data + step builders for both algorithms
├── app.js           # State, SVG rendering, UI wiring
└── README.md
```

No build step. No dependencies. Open `index.html` in any modern browser and it works.

## Running locally

```bash
# Clone the repo
git clone https://github.com/scotthadzik/cs2420-graph-visualizer.git
cd cs2420-graph-visualizer

# Open in a browser
start index.html     # Windows
open index.html      # macOS
xdg-open index.html  # Linux
```

## Deploying

GitHub Pages is enabled on the `main` branch. Push to `main` and GitHub will serve the latest version at the live URL above within ~1 minute. No CI workflow needed.

## Embedding in Canvas

Canvas pages support iframes pointing to external content. Use this snippet:

```html
<iframe
  src="https://scotthadzik.github.io/cs2420-graph-visualizer/"
  width="960"
  height="820"
  frameborder="0"
  style="max-width: 100%;">
</iframe>
```

## License

Course teaching material &mdash; free to use and adapt for educational purposes.
