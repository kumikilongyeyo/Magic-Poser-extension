# Magic Poser Helper

Chrome extension prototype for **reference-to-pose assistance in Magic Poser**.

## Current milestone — v0.6

The UI is intentionally reduced to the actual workflow:

**Reference → Auto Trace → Match Pose**

### Normal workflow

1. If this mannequin/view has not been mapped yet, press **Map Model** once and click the requested visible black controls on the Magic Poser figure.
2. Paste or upload a pose reference.
3. Press **Auto Trace** to place the editable stickman over the person.
4. Drag any stickman joint that looks wrong.
5. Press **Match Pose**.

After setup, the mapping card collapses into a small **Model Ready** status. Secondary controls are hidden under **Pose Options**.

## Auto Trace

Auto Trace uses MediaPipe Pose Landmarker Heavy as a fast browser-side first pass. It reduces the detector output to the helper's deliberately small 13-joint correction skeleton: head, chest, pelvis, shoulders, elbows, wrists, knees and ankles.

It only runs when you press **Auto Trace**. The AI result is never final: the editable stickman remains the correction layer.

## Model-control sync

The visual driver stores the locations of Magic Poser's visible controls. v0.6 now attempts to refresh those locations from the Magic Poser canvas before every Match Pose using compact dark-control detection.

This means modest pose/camera changes should no longer immediately invalidate the saved map. If the controls moved too far for a safe automatic refresh, the helper asks for **Remap** instead of silently doing nothing.

Manual Map Model remains the reliable fallback.

## Pose Options

Hidden by default to keep the panel clean:

- Loose / Close / Strict
- Whole / Upper / Lower
- Keep Feet
- Mirror
- Undo / Redo
- Reset Model Mapping

## Architecture

```text
Reference image
      ↓
Auto Trace
      ↓
Editable stickman
      ↓
Saved / refreshed Magic Poser control map
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
