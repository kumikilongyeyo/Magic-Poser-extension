Suggested Frankenstein stack:

1. RTMW3D or MMPose for main 3D pose estimate
2. DWPose as 2D confidence / fallback pass
3. Sketch parser for rough stickman cleanup
4. pose-three or a lightweight IK solver for joint limits and cleanup
5. Adapter that converts normalized skeleton rotations into Magic Poser joint commands

Keep these as swap-in modules so the UI stays stable.
