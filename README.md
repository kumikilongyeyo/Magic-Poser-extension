# Magic Poser Helper

Chrome extension prototype for **reference-to-pose assistance in Magic Poser**.

## Current milestone — v0.5.2

The extension has two separate jobs:

1. **Auto Trace** reads a pasted/uploaded reference and places the editable stickman over the person.
2. **Match Pose** drives Magic Poser's visible 3D body controls toward that corrected stickman.

The current visual driver still needs a one-time **3D Model Controls** map for the current mannequin/camera framing. This is a required step, so v0.5.2 moves it out of Advanced and makes it visible in the normal workflow.

## Normal workflow

1. Press **Map Controls** and click each requested black Magic Poser control on the mannequin.
2. Paste or upload a reference.
3. Press **Auto Trace**. It does not run automatically.
4. Drag any stickman joint that the scan got wrong. Yellow joints are lower-confidence detections worth checking.
5. Press **Match Pose**.
6. Adjust the reference skeleton and press Match Pose again if needed.

If you move/zoom the Magic Poser camera or change the mannequin framing, press **Remap** before matching again because the visual driver stores those control positions in screen space.

### Current visible controls

- Paste / Upload / Sketch
- Auto Trace
- Map Controls / Remap
- Match Pose
- Loose / Close / Strict
- Whole / Upper / Lower
- Keep Feet
- Mirror
- Undo / Redo

The old natural-language pose box was removed from the main UI because spatial pose editing is faster and clearer by directly dragging the reference skeleton.

## Guided 3D control mapping

Mapping is no longer hidden under Advanced. Starting Map Controls collapses the large helper body out of the way and shows a small floating instruction telling you exactly which mannequin control to click next. Each accepted control gets a visual confirmation. Esc cancels mapping.

## Auto Trace

Auto Trace uses **MediaPipe Pose Landmarker Heavy** to estimate body landmarks and reduces them to the helper's intentionally small 13-joint skeleton: head, chest, pelvis, shoulders, elbows, wrists, knees and ankles.

The editable stickman remains the correction layer. AI detection is only a first pass; it never needs to be perfect.

For this prototype, MediaPipe runtime/model assets are loaded on demand from pinned CDN/model URLs. A future packaged release should vendor runtime assets locally.

## Architecture

```text
Reference image
      ↓
Auto Trace (MediaPipe Heavy)
      ↓
Editable 13-joint stickman
      ↓
Saved visible Magic Poser control map
      ↓
Canvas control dragging
      ↓
Magic Poser character
```

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository folder.
6. Open `https://webapp.magicposer.com/`.

## Next major improvement

Automatically detect/refresh Magic Poser's visible black control dots before Match Pose so manual Map Controls becomes a fallback instead of a required step.
