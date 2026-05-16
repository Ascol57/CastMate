# Linux compatibility changes

This document records every change made while adding Linux support to CastMate.
All existing Windows code paths are preserved — every modification is additive or
behind a runtime/OS condition.

The work is split into milestones (M1–M8). M1, M2 and M3 are implemented and
verified on this Linux host. M4–M8 are scoped and queued.

---

## M1 — Native module Linux stubs

Both Windows-only C++ native plugins now compile cleanly on Linux through
OS-conditional `binding.gyp` files. Linux gets stub implementations that expose
the same JavaScript surface (same class names, same method names) as the
Windows implementation, so the rest of the codebase imports them without
changes. Real Linux backends are tracked under M6 (input) and M7 (sound).

### Files changed

- `plugins/input/native/binding.gyp` — `sources` is now driven by an `OS`
  condition. Windows keeps compiling `src/native-index.cc` and
  `src/input-interface.cc`; non-Windows compiles the new stub file.
- `plugins/input/native/src/linux/native-index-linux.cc` *(new)* — Linux stub
  for the `NativeInputInterface` class. All seven methods (`simulateKeyDown`,
  `simulateKeyUp`, `simulateMouseDown`, `simulateMouseUp`, `startEvents`,
  `stopEvents`, `isKeyDown`) are no-ops with matching signatures.
- `plugins/sound/native/binding.gyp` — same OS-conditional split for the four
  Windows source files (`native-index.cc`, `util.cc`, `audio-interface.cc`,
  `tts-interface.cc`).
- `plugins/sound/native/src/linux/native-index-linux.cc` *(new)* — Linux stub
  for `NativeAudioDeviceInterface` (returns an empty array / `undefined`) and
  `OsTTSInterface` (returns an empty array / `false`).

### Verification

`yarn install` completes without `YN0009` build failures and both native
modules produce a `.node` artifact under `build/Release/`.

---

## M2 — Cross-platform `ffmpeg` / `ffprobe` resolution

`ffmpeg` and `ffprobe` now resolve to the correct binary at runtime on every
supported OS. The universal installer packages select the matching native
binary (`@ffmpeg-installer/linux-x64` on Linux, `darwin-x64`/`darwin-arm64` on
macOS, `win32-x64` on Windows), and the packaged path strips the `.exe`
suffix on non-Windows targets.

### Files changed

- `package.json` (root) — added two universal dependencies:
  `@ffmpeg-installer/ffmpeg ^1.1.0` and `@ffprobe-installer/ffprobe ^2.1.2`.
  The existing `@ffmpeg-installer/win32-x64` and `@ffprobe-installer/win32-x64`
  entries are kept so the Windows resolution path is unchanged (they are also
  pulled transitively by the universal packages on Windows).
- `libs/castmate-core/src/media/ffmpeg.ts`:
  - Added `createRequire` import and uses it to load the two universal
    installer packages (avoids ESM/CJS friction with their CJS-only shape
    when bundled by Electron main).
  - `setupFFMpegPaths()`:
    - Dev mode: uses `ffmpegInstaller.path` and `ffprobeInstaller.path` from
      the universal packages.
    - Packaged mode: resolves `ffmpeg${exeSuffix}` and `ffprobe${exeSuffix}`
      inside the `ffmpeg/bin` resource folder, where
      `exeSuffix = process.platform === "win32" ? ".exe" : ""`.
- `packages/castmate/electron-builder-config.cjs`:
  - The Windows-only `extraResources` (ffmpeg, ffprobe, `regedit/vbs`) moved
    from the top-level `extraResources` array into `win.extraResources`.
    Same entries, same filters — they now only ship on Windows builds.
  - New `linux` block: `target: ["AppImage", "deb"]`,
    `category: "AudioVideo"`,
    `artifactName: "${productName}_${version}_${arch}.${ext}"`,
    plus a `linux.extraResources` array that bundles the Linux `ffmpeg` and
    `ffprobe` binaries into the same `ffmpeg/bin` layout the runtime
    expects.

### Verification

On this Linux host, `@ffmpeg-installer/ffmpeg` resolves to
`node_modules/@ffmpeg-installer/linux-x64/ffmpeg` (exists, executable);
likewise for `ffprobe`. The packaged-mode path expression has been
type-checked.

---

## M3 — `yarn dev` launches Electron on Linux

Two small fixes unblock the dev workflow on Linux. Neither changes Windows
behaviour.

### Files changed

- `packages/castmate/vite.config.mts` — in the `electron()` plugin's `onstart`
  callback, `delete process.env.ELECTRON_RUN_AS_NODE` is now called before
  `args.startup([".", "--no-sandbox"])`. Some shells (notably some
  sandboxed CLI runners) inherit `ELECTRON_RUN_AS_NODE=1` from their parent
  environment. When that variable is set, Electron boots as plain Node
  instead of as a Chromium main process, so `require("electron")` resolves
  to the npm package's CJS file (which exports the binary's install path as
  a string) instead of the synthetic API module — every
  `import { app } from "electron"` then fails. This cleanup is defensive: it
  has no effect on Windows or on a normal Linux desktop session, but it
  makes `yarn dev` robust to a misconfigured parent environment.
- `libs/castmate-core/src/viewer-data/viewer-data.ts:319` —
  `resolveProjectPath("/viewer-data")` changed to
  `resolveProjectPath("viewer-data")`. The leading `/` made
  `path.resolve(activeProjectDirectory, "/viewer-data")` return
  `/viewer-data` (Node treats a leading slash as a fresh absolute root).
  The directory was therefore being created at the filesystem root on
  Linux (`EACCES`) and at the drive root on Windows. Dropping the slash
  resolves the path inside the project directory on every platform.

### Verification

`yarn dev` boots Electron with a visible window, creates the user directory
under `~/CastMate/user`, prints the resolved ffmpeg/ffprobe Linux paths,
and reaches the renderer/Vite hot-reload loop.

---

## Roadmap

Not yet implemented; tracked here for visibility.

- **M4 — OBS plugin Linux support.** Replace the Windows registry lookup
  (`regedit`) and `Start-Process` PowerShell launch with a `$PATH` search and
  a direct `spawn`. Track `obs64.exe` on Windows vs `obs` on Linux for the
  running-process check.
- **M5 — OS plugin Linux support.** Branch `tasklist` → `ps`,
  `cmd /c start` → `xdg-open`, `powershell.exe` → the user's shell or a
  direct `bash -c`.
- **M6 — Real `plugins/input/native` Linux backend.** Replace the no-op
  stubs with XTest (X11) or libevdev + `uinput` for real keyboard/mouse
  simulation and event capture.
- **M7 — Real `plugins/sound/native` Linux backend.** PulseAudio (or
  PipeWire) for device enumeration; `speech-dispatcher` for TTS.
- **M8 — `electron-builder` Linux pipeline + CI matrix.** Validate AppImage
  and `.deb` end-to-end; add `ubuntu-latest` (and ideally `macos-latest`)
  to `.github/workflows/build.yaml` alongside `windows-latest`.
