# BeliefAct project page

Static page, no build step. Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

All data are plain `<script>` files, so the page also works from `file://`.

## Layout

| Path | Content |
|---|---|
| `index.html` | Page and the replay-panel logic |
| `assets/css/site.css` | Styles |
| `assets/js/replay.js` | Canvas replay engine (agents, trails, montage zoom) |
| `assets/js/charts.js` | Result charts (inline SVG) |
| `assets/img/fig{1,2,3}.png` | Paper figures |
| `assets/paper.pdf` | The paper (preprint) |
| `assets/tpv/<scene>_{top,iso}.webp` | Isaac Sim renders of the scenes (cut-away, ceilings hidden) |
| `assets/video/*.mp4` | 1080p, 60 fps exports of two replays |
| `assets/plans/<scene>.png` | Floor plans drawn from the BEHAVIOR-1K layout maps |
| `data/cases/<task>__<instance>.js` | One replay: every method's logged actions, positions, reasoning, BeliefAct's belief per round, and the other agents' moves |
| `data/stories.js` | Hand-written text for each replay (checked against the logs) |
| `data/results.js` | Completion-within-budget curves computed from `paper/duet_main.csv` and `paper/duet_hume.csv` of the [code release](https://github.com/andyhandsom6/BeliefAct) |

## What the replays show

Episodes are the logged runs of the paper's main experiment (Gemini 3.8 Flash, 200-round horizon).
The position of each robot after every action is the logged pose. Navigation in these runs moves the
robot between positions directly, so the line drawn between two consecutive positions is a shortest
walkable route on the floor plan, computed for display. Positions are mapped onto
the renders with the camera's floor-plane homography; on the furniture of each scene, projected
bounding boxes match the rendered segmentation to a median of a few pixels.

