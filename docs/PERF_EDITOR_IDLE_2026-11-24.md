# MapMaker at rest and the leak question (2026-11-24, `wip/editor-idle-1124`)

By a helper of lane B's splitters22, from the owner's M1 trace of 2026-11-24 (58.7 s: 48 s in a Test, then Back to
MapMaker and two edits). The owner said "yes start 1 and 2".

## In plain English

- **MapMaker drew the whole scene every frame, even when nothing moved.** At rest it sat at about 40 fps with the
  main thread about 100% busy (working out what is in view 31%, drawing 46%, binding materials 21%; the editor's own
  code 1.6%). Now it draws every frame only while something moves or changes, and **15 frames a second at rest**
  (4 while the window is in the background), with what is in view worked out once and kept ("frozen") until
  anything changes. Water, swaying plants and the fence's pulse keep moving, at that slower rate.
- **Edits are as quick as before**: the first input wakes it before the frame is drawn, and every frame is drawn for
  half a second after anything changes.
- **Nothing is left stale**: pictures after the common actions (select, drag, place, paint, plan view) are the same
  as the same view drawn afresh, and the same with the old way (`?perfoff=editoridle`).
- **The "panel built twice"** in the trace was real: an edit that selects what it made (duplicate, paste…) built the
  inspector in the selection and again on the next frame. A tile's inspector is about 1,400 nodes, a set piece's
  about 1,800: the trace's 1,357 then 1,462 nodes within 70 ms. Now once.
- **The leak question**: SEE BELOW
