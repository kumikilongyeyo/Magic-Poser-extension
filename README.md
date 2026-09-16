# Magic Poser Helper

A Chrome extension prototype for **reference-to-pose assistance in Magic Poser**.

The current approach deliberately avoids depending on Magic Poser's hidden/private rig internals. Instead, it uses a **visual control map**: the user maps the important visible Magic Poser body controls once, then the extension can drive those controls from a reference skeleton.

## Current milestone — v0.4

This is the first working baseline where **Match Pose can physically move the Magic Poser character**.

### Current workflow

1. Open Magic Poser and load the extension.
2. Paste or upload a pose reference, or use Sketch mode.
3. Open **Advanced → Setup / Remap Magic Poser Controls** once and map the important visible controls.
4. Drag the overlay skeleton to approximately match the reference.
5. Choose **Whole / Upper / Lower** and **Loose / Close / Strict**.
6. Press **Match Pose**.
7. Use the command box for quick corrections.

### Main controls

The normal UI intentionally stays small:

- Paste / Upload / Sketch
- Match Pose
- Loose / Close / Strict
- Whole / Upper / Lower
- Keep Feet
- Mirror
- Undo
- Natural-language quick fixes

Advanced rig mapping is hidden under **Advanced**.

## Known UX issues / next priorities

- Make the reference/trace panel resizable or provide an expanded tracing mode.
- Add Redo beside Undo.
- Clearly highlight which skeleton joint is currently selected/being dragged.
- Improve tracing precision and reference zoom/pan.
- Improve pose accuracy beyond the current screen-space approximation.
- Add automatic pose landmark extraction so manual tracing becomes optional.

## Architecture

```text
Reference image / sketch
        ↓
Editable skeleton overlay
        ↓
Pose helper / command corrections
        ↓
Saved visual Magic Poser control map
        ↓
Canvas control dragging
        ↓
Magic Poser character
```

### Why visual control mapping?

Earlier prototypes tried to connect to Magic Poser's internal WASM/rig runtime. That path proved fragile across the live web app. v0.4 instead maps the controls that are already visible on screen, making the extension less dependent on undocumented internals.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository folder.
6. Open `https://webapp.magicposer.com/`.

## Status

Early prototype / active development. The visual driver works, but pose matching is still approximate and the UX is being refined.
