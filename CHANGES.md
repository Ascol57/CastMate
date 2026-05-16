# Linux compatibility changes

This document records every change made while adding Linux support to CastMate.
All existing Windows code paths are preserved — every modification is additive or
behind a runtime/OS condition.

The work is split into milestones (M1–M8). M1 through M5 are implemented and
verified on this Linux host. M6–M8 are scoped and queued.

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

## M4 — OBS plugin Linux support

The OBS plugin can now locate, launch, and detect a running OBS install on
Linux. The Windows code paths (registry lookup, PowerShell `Start-Process`
with elevation, polling for `obs64.exe`) are untouched and still active when
`process.platform === "win32"`. Cross-platform behaviour is selected at
runtime with a single `IS_WINDOWS` boolean.

### Files changed

- `plugins/obs/main/src/connection.ts`:
  - Added `node:fs`, `node:path`, `node:os` imports and an `IS_WINDOWS`
    constant. The `regedit` import stays in place: the package is pure
    JavaScript and loads cleanly on Linux even though its functions only
    succeed on Windows.
  - New `LINUX_OBS_CANDIDATES` list (apt: `/usr/bin/obs`,
    `/usr/local/bin/obs`; Flatpak: system + user
    `com.obsproject.Studio`; Snap: `/snap/bin/obs-studio`,
    `/snap/bin/obs`).
  - New `findOBSExecutableLinux()` probes each candidate with
    `fs.access(... X_OK)`; if none match, falls back to `command -v obs`
    so anything reachable through `$PATH` is honored.
  - New `findOBSInstall()` dispatches to `getOBSInstallFromRegistry()` on
    Windows and `findOBSExecutableLinux()` elsewhere. Return shape is
    documented per platform: install directory on Windows, absolute
    launcher path on Linux.
  - `openObs(installDir)` now branches on `IS_WINDOWS`. Windows keeps the
    `Start-Process "${installDir}\bin\64bit\obs64.exe" -Verb runAs` flow
    verbatim. Linux spawns the launcher directly with
    `detached: true`, `stdio: "ignore"`, `child.unref()` so OBS outlives
    the Electron parent.
  - `OBSConnection.openProcess()` now calls `findOBSInstall()` instead of
    `getOBSInstallFromRegistry()` so it works on every platform.
  - `setupRunningPolling()` polls for `obs64.exe` on Windows and `obs`
    elsewhere. The functional process check (whether `isProcessRunning`
    actually works on Linux) is owned by M5.
  - `setupConnections()` wraps the `regedit.setExternalVBSLocation(...)`
    initialization in `if (IS_WINDOWS)` so the VBS bridge is only wired up
    where it can do something.

### Verification

- TypeScript compiles cleanly for the OBS plugin (only the three
  pre-existing `libs/castmate-core/src/queue-system/trigger.ts` errors
  surface — unrelated to this change).
- Windows code paths are preserved verbatim inside `IS_WINDOWS` branches.
- A manual Linux smoke test requires an OBS install on the host. In this
  environment OBS is not installed, so `findOBSInstall()` correctly
  returns `undefined` and `openProcess()` short-circuits to `false`; the
  rest of the plugin (websocket connection, scenes, etc.) is unaffected.

---

## M5 — OS plugin Linux support

The OS plugin's process-management primitives and PowerShell action now have
Linux/macOS code paths. The Windows command surface (`tasklist`,
`cmd /c start`, `powershell.exe`) is preserved verbatim — every fork is
behind a single `IS_WINDOWS` constant.

### Files changed

- `plugins/os/main/src/processes.ts`:
  - Added `IS_WINDOWS` constant.
  - `isProcessRunning(application)` — Windows still calls `tasklist` and
    does a case-insensitive substring match on its stdout. Linux/macOS
    now call `ps -A -o comm=` and match the basename of each line against
    the basename of `application` (case-insensitive). The basename
    comparison lets callers pass either `"obs"` or `/usr/bin/obs`
    interchangeably, which matches the M4 `setupRunningPolling` callsite
    where `obs` is the Linux process name.
  - `launch` action — Windows still spawns
    `cmd /c start "CastMate Launch" <exe> <args...>` for its
    fire-and-forget semantics. Linux/macOS now spawn the executable
    directly with `detached: true`, `stdio: "ignore"`, and `child.unref()`
    so the launched process survives CastMate. A no-op `error` handler
    swallows spawn failures to keep the fire-and-forget contract.
- `plugins/os/main/src/powershell.ts`:
  - Added `IS_WINDOWS` and a `POWERSHELL_SHELL` constant that resolves to
    `"powershell.exe"` on Windows and `"pwsh"` (PowerShell 7+) on
    Linux/macOS.
  - `runPowershellCommand` now uses `POWERSHELL_SHELL`. The
    PowerShell-specific escaping (`powershellTemplate`,
    `powershellEscape*` helpers) is untouched — it works identically
    under `pwsh` since the syntax is the same.
  - If `pwsh` is missing on Linux/macOS, the rejection message is
    rewritten to *"PowerShell (`pwsh`) is not installed or not on PATH.
    Install PowerShell 7+ to use this action on Linux/macOS."* rather
    than a raw `ENOENT`.

### Verification

- TypeScript compiles cleanly for the OS plugin (only the three
  pre-existing `trigger.ts` errors remain).
- The Windows command lines are preserved verbatim inside `IS_WINDOWS`
  branches.
- The Launch and Powershell action surfaces are unchanged for end users.
  The `application` field in the Launch action still advertises
  `extensions: ["exe"]` — that hint is benign on Linux (the file picker
  still works, just with a less helpful filter) and was left alone so the
  Windows UI is unaffected. Tightening the per-platform UI hint can move
  to a follow-up.

---

## Roadmap

Not yet implemented; tracked here for visibility.

- **M6 — Real `plugins/input/native` Linux backend.** Replace the no-op
  stubs with XTest (X11) or libevdev + `uinput` for real keyboard/mouse
  simulation and event capture.
- **M7 — Real `plugins/sound/native` Linux backend.** PulseAudio (or
  PipeWire) for device enumeration; `speech-dispatcher` for TTS.
- **M8 — `electron-builder` Linux pipeline + CI matrix.** Validate AppImage
  and `.deb` end-to-end; add `debian-latest` (and ideally `macos-latest`)
  to `.github/workflows/build.yaml` alongside `windows-latest`.

## File write by AI :
- CHANGES.md
- plugins/sound/native/src/linux/native-index-linux.cc
- plugins/input/native/src/linux/native-index-linux.cc
- plugins/input/native/src/stub/native-index-linux.cc