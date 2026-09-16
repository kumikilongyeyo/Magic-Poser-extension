# Magic Poser Helper

A Chrome extension prototype for **reference-to-pose assistance in Magic Poser**. It uses a saved visual control map instead of depending on Magic Poser's private rig internals.

## Current milestone — v0.5

**Auto Trace is now wired in.** Paste or upload a reference and the extension automatically asks MediaPipe Pose Landmarker Heavy to place the editable 13-joint stickman over the person. You only fix the joints that look wrong, then press **Match Pose**.

### Normal workflow

1. Paste / upload a reference.
2. **Auto Trace runs automatically** (or press Auto Trace to rescan).
3. Yellow joints are lower-confidence points worth checking. Drag only what looks wrong.
4. Choose Whole / Upper / Lower and Loose / Close / Strict.
5. Press **Match Pose**.
6. Use the command box for small corrections.

### First-use setup

Open **Advanced → Setup / Remap Magic Poser Controls** and click the requested visible Magic Poser controls once. The map is saved locally.

### Main controls

- Paste / Upload / Sketch
- Auto Trace
- Match Pose
- Loose / Close / Strict
- Whole / Upper / Lower
- Keep Feet
- Mirror
- Undo / Redo
- Natural-language quick fixes

The tracing panel is expandable/resizable and the selected stickman joint is clearly highlighted.

## Auto Trace scanner

The default scanner uses **MediaPipe Pose Landmarker Heavy** and reduces its landmarks to the helper's intentionally small pose skeleton: head, chest, pelvis, shoulders, elbows, wrists, knees and ankles. Confidence/visibility is used to mark uncertain joints in yellow. If you manually corrected a joint, a later low-confidence rescan will not overwrite it.

For this prototype, the MediaPipe JS/WASM runtime and model are loaded on demand from pinned jsDelivr / Google model URLs. The first scan therefore needs internet and may take a few seconds. Before Chrome Web Store packaging, those runtime assets should be vendored locally to comply with store rules around remotely hosted code.

### Next accuracy upgrade

An optional RTMW3D / RTMW whole-body backend can be added later for extreme foreshortening, difficult artwork, and higher-quality depth estimates. The normal UI should still remain a single **Auto Trace** action.

## Architecture

```text
Reference image
      ↓
MediaPipe Heavy Auto Trace
      ↓
Editable 13-joint stickman
      ↓
Saved visual Magic Poser control map
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

## Status

Early prototype / active development. Auto Trace and the visual driver are functional building blocks, but final pose accuracy is still limited by Magic Poser's screen-space control behavior and single-image depth ambiguity.
