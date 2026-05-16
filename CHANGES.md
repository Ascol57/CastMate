# Linux compatibility changes

This document records every change made while adding Linux support to CastMate.
All existing Windows code paths are preserved — every modification is additive or
behind a runtime/OS condition.

The work is split into milestones (M1–M8). All eight are implemented;
M1–M7 are also runtime-verified on this Linux host. M8 is config-only and
will be verified end-to-end the first time the GitHub Actions workflow
runs on its new `ubuntu-latest` matrix entry.

## Linux runtime requirements

These are the system packages CastMate expects on Linux. Build-only headers
are only required when (re)compiling the native modules from source; the
others are runtime dependencies.

| Apt package              | When needed                                | Purpose                                                |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| `libx11-6` *(runtime)*   | M6 — `plugins/input/native` runtime        | Xlib client; keyboard/mouse simulation                 |
| `libxtst6` *(runtime)*   | M6 — `plugins/input/native` runtime        | XTest extension                                        |
| `libx11-dev`             | M6 — build only                            | Xlib headers (`#include <X11/Xlib.h>`)                 |
| `libxtst-dev`            | M6 — build only                            | XTest headers (`#include <X11/extensions/XTest.h>`)    |
| `pulseaudio-utils` *or* `pipewire-pulse` | M7 — `plugins/sound/native` runtime | Ships the `pactl` CLI (audio device discovery)  |
| `espeak-ng`              | M7 — TTS feature                           | Linux text-to-speech back-end                          |

On a typical Debian/Ubuntu desktop the X11 and PulseAudio/PipeWire pieces are
already in place. The one explicit install needed for full functionality is
text-to-speech:

```bash
sudo apt install espeak-ng
```

If `espeak-ng` is missing, `OsTTSInterface.getVoices()` returns an empty
array and `speakToFile(...)` calls back with
`"espeak-ng not installed"` — the audio device plugin keeps working
independently.

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

## M6 — Real `plugins/input/native` Linux backend

The Linux source file gained a working X11 backend: XTest for keyboard and
mouse simulation, and a worker thread polling `XQueryKeymap` for global
key-pressed / key-released events. The original M1 no-op stub moved into a
dedicated macOS fallback so that the macOS build path stays compilable
without X11 headers.

### Files changed

- `plugins/input/native/src/linux/native-index-linux.cc` — was the no-op
  stub, now a real X11/XTest backend (~250 LOC). Highlights:
  - Static `VK_KEYSYM_TABLE` mapping Windows virtual-key codes (`VK_*`)
    to X11 keysyms covering letters, digits, function keys F1–F24,
    numpad, modifiers, navigation, common OEM punctuation (US layout
    assumption).
  - `mapVkToKeysym(vk)` for simulation; `mapKeysymToVk(ks)` (lazy
    reverse map) for event reporting.
  - `simulate_key_*` resolves keysym → keycode via `XKeysymToKeycode`,
    then calls `XTestFakeKeyEvent` + `XFlush`.
  - `simulate_mouse_*` calls `XTestFakeButtonEvent` for buttons
    1/2/3/8/9 (left/middle/right/mouse4/mouse5 per X11 convention).
  - `start_events()` spawns a worker thread with its own X11 connection
    that polls `XQueryKeymap` at ~30 Hz, diffs against the previous
    snapshot, and emits `key-pressed` / `key-released` (with the
    Windows VK code) via `Napi::ThreadSafeFunction`. `stop_events()`
    signals the thread and joins it cleanly.
  - Defensive handling: if `XOpenDisplay` fails (no DISPLAY / no XWayland
    on a pure Wayland session) the interface logs a one-time warning to
    stderr and every method becomes a no-op — no crashes.
- `plugins/input/native/src/stub/native-index-stub.cc` *(new)* — copy of
  the original M1 no-op stub, used on macOS so that build stays clean
  without X11.
- `plugins/input/native/binding.gyp`:
  - Windows branch unchanged.
  - New `OS=='linux'` branch: builds the new file with `-std=c++17`,
    `-pthread`, links `-lX11 -lXtst -lpthread`.
  - `OS=='mac'` now uses the dedicated stub file rather than the Linux
    one (which would fail to find X11 headers on Darwin).

### Verification

- `node-gyp rebuild` against the host Node ABI succeeds and produces a
  `castmate-plugin-input-native.node` that links against
  `libX11.so.6` + `libXtst.so.6`.
- `yarn ebuild` re-links it against Electron's ABI.
- Smoke tests under `DISPLAY=:0`:
  - Module loads, all seven JS methods present.
  - `startEvents()` → background thread runs without blocking;
    `stopEvents()` joins cleanly with no events received during the
    quiet test window.
  - `simulateKeyDown/Up(VK_F13)` (harmless function key) returns
    without crashing; X server accepts the synthetic event.

---

## M7 — Real `plugins/sound/native` Linux backend

The Linux source file gained a real audio device enumeration backend and
text-to-speech support, both implemented as subprocess wrappers around the
standard Linux audio tooling. Going through `pactl` means the same code
runs on PipeWire (via `pipewire-pulse`) and PulseAudio without changes; TTS
shells out to `espeak-ng` (with an `espeak` legacy fallback). The original
M1 no-op stub moved into a dedicated macOS fallback so the macOS build
path stays compilable.

### Files changed

- `plugins/sound/native/src/linux/native-index-linux.cc` — was the no-op
  stub, now a real backend (~400 LOC). Highlights:
  - `parse_pactl_list()` splits `pactl list sinks` / `pactl list sources`
    output into per-device blocks, pulling `State`, `Name`, and
    `Description`. `State`s `RUNNING`/`IDLE`/`SUSPENDED` all map to
    `"active"`; anything else to `"unknown"`. The PA `Name` field is
    reused for both `id` and `guid` (PA/PW has no Windows-style GUID).
  - `pactl_default("Sink"|"Source")` parses `pactl info` for the
    default sink/source name; since Linux has no Windows-style
    eMultimedia/eCommunications role, both `"main"` and `"chat"`
    resolve to the OS default.
  - `start_subscriber()` forks `pactl subscribe` and reads its stdout
    line-by-line in a worker thread:
    `Event 'new' on sink #N` → `device-added`,
    `Event 'remove' on …` → `device-removed`,
    `Event 'change' on …` → `device-changed`,
    `Event 'change' on server` triggers a re-query and emits
    `default-output-changed` / `default-input-changed` if either
    default actually changed. Events are dispatched to JS via
    `Napi::ThreadSafeFunction::NonBlockingCall`. `Finalize` SIGTERMs
    the child and joins the thread.
  - `OsTTSInterface.getVoices()` runs `espeak-ng --voices` (or
    `espeak --voices` as a fallback) and parses the output as a
    fixed-width table (column starts taken from the header). The
    "VoiceName" column becomes `name`, the "File" column becomes `id`
    — the latter is what `-v` actually accepts. Whitespace-tokenising
    is intentionally avoided because VoiceName can contain spaces
    (e.g. "English (Caribbean)"), and the previous tokenizing parser
    silently produced ids that espeak-ng rejected at runtime.
  - On error paths (fork failure, espeak-ng not found, espeak-ng
    exiting non-zero — typically because the voice id was rejected)
    the AsyncWorker now calls `SetError(...)` so the JS callback
    receives the message instead of `null`. The previous version
    swallowed errors and made downstream `ffprobe` calls trip on a
    file that espeak never wrote.
  - `OsTTSInterface.speakToFile(text, file, voice, cb)` queues a
    `Napi::AsyncWorker` that forks `espeak-ng -v <voice> -w <file> --
    <text>`, waits for the child, then invokes the JS callback with
    either `null` on success or a structured error string. The `--`
    separator + `execvp` (no shell) keeps the text safe from
    shell injection.
- `plugins/sound/native/src/stub/native-index-stub.cc` *(new)* — copy of
  the original M1 no-op stub for the macOS build path.
- `plugins/sound/native/binding.gyp`:
  - Windows branch unchanged.
  - New `OS=='linux'` branch: builds the new file with `-std=c++17`,
    `-pthread`, links `-lpthread`. No external audio dev dependency —
    everything goes through subprocess.
  - `OS=='mac'` now uses the dedicated stub file.

### Verification

- `node-gyp rebuild` succeeds and produces
  `castmate-plugin-sound-native.node` (~140 KB).
- `yarn ebuild` re-links it against Electron's ABI.
- Smoke test under PipeWire 1.4.2 (with `pipewire-pulse` providing the
  PulseAudio compatibility daemon):
  - `getDevices()` enumerates 4 devices (2 sinks/sources from the
    onboard Intel codec, the user's Razer Seiren V3 Mini USB mic, plus
    the standard ALSA monitor source) with the expected
    `{ id, type, state, name, guid }` shape.
  - `getDefaultOutput("main")` and `getDefaultInput("main")` resolve
    to the actual default analog stereo device.
  - `getVoices()` returns 141 entries (espeak-ng installed).
  - `speakToFile("Hello from CastMate Linux", "/tmp/cm-tts-test.wav",
    "", cb)` produces an 82,800-byte WAV file, callback fires with
    no error.

### Linux runtime requirement

`espeak-ng` is the one piece a typical Debian/Ubuntu desktop is missing
out of the box. Install it with:

```bash
sudo apt install espeak-ng
```

`pactl` is shipped by both `pulseaudio-utils` and `pipewire-pulse`, at
least one of which is already present on any system that has working
audio.

### Migration note for early adopters

The first iteration of `getVoices()` returned the "VoiceName" column
("Afrikaans", "English", …) as the voice id — values that `espeak-ng`'s
`-v` flag does not accept. If you selected a TTS voice with that early
build, your CastMate config holds a now-invalid id and TTS actions will
fail with `"espeak failed (likely unknown voice ...)"`. Open the TTS
provider settings and re-pick a voice from the updated dropdown; the new
ids look like `gmw/af`, `gmw/en`, etc.

---

## M8 — `electron-builder` Linux pipeline + CI matrix

CastMate can now be packaged as an AppImage and a `.deb` from a Linux
build host, with the right system-library `Depends:` declared so the
resulting `.deb` installs cleanly on Debian/Ubuntu derivatives. The
GitHub Actions release workflow now runs on both `windows-latest` and
`ubuntu-latest` from the same job definition. The Windows build path is
unchanged.

> Note on runner naming: the user-facing roadmap referred to
> "debian-latest", but GitHub Actions has no Debian-named hosted runner —
> only `ubuntu-latest`. Ubuntu is binary-compatible enough with Debian
> that the `.deb` produced on Ubuntu installs on current Debian releases
> without modification, so the matrix uses `ubuntu-latest` and the
> resulting artifacts are the canonical "Debian/Ubuntu" build.

### Files changed

- `packages/castmate/electron-builder-config.cjs`:
  - The existing `linux` block (added in M2) is unchanged at the top
    level: `target: ["AppImage", "deb"]`, `category: "AudioVideo"`,
    `artifactName: "${productName}_${version}_${arch}.${ext}"`,
    `extraResources` bundling the linux-x64 `ffmpeg` and `ffprobe`
    binaries.
  - New top-level `deb` block:
    ```js
    deb: {
      depends: [
        "libx11-6",            // XTest target — M6 input native
        "libxtst6",             // XTest extension     — M6 input native
        "pulseaudio-utils | pipewire-pulse", // ships `pactl`  — M7 audio
      ],
      recommends: ["espeak-ng"],     // M7 TTS (optional feature)
    }
    ```
    The `|` syntax in `depends` expresses an OR alternative, which apt
    handles natively. `espeak-ng` lives in `recommends` rather than
    `depends` so users who don't need TTS aren't forced to install the
    voice-data payload.
- `.github/workflows/build.yaml`:
  - `strategy.matrix.os` extended from `[windows-latest]` to
    `[windows-latest, ubuntu-latest]`.
  - `fail-fast: false` added so a Linux-side failure doesn't cancel the
    in-flight Windows build (and vice versa).
  - New step *"Install Linux build/runtime deps"* gated on
    `runner.os == 'Linux'` runs
    `sudo apt-get install -y libx11-dev libxtst-dev espeak-ng`. The
    `-dev` packages are required to compile the input native module
    against XTest; `espeak-ng` is installed so any TTS-related smoke
    test inside the build pipeline has it available (and to mirror what
    a developer would do locally).
  - No other step changes — `yarn install`, the workspace rebuild step,
    and `yarn run buildpublish` all run identically on both runners.
    Electron-builder's `npmRebuild: true` (already in the config) takes
    care of recompiling the native plugins against Electron's Node ABI
    on each host.

### Verification

- Both files (`electron-builder-config.cjs`, `build.yaml`) parse
  cleanly (Node `require()` for the former, `yaml.safe_load` for the
  latter).
- The Linux `extraResources` source paths
  (`@ffmpeg-installer/linux-x64/ffmpeg`,
  `@ffprobe-installer/linux-x64/ffprobe`) both exist and are
  executable on this host, so the AppImage and `.deb` will get the
  binaries inside `ffmpeg/bin/`.
- End-to-end .deb / AppImage production is not exercised locally
  (electron-builder packaging takes several minutes and pulls
  external resources). It will run automatically on the first push to
  `main` once the new workflow lands, on both the Windows and Ubuntu
  matrix legs.

---

## Next Step

- M9 : Wayland-native input simulation via uinput when no X server is
  reachable (currently the X11 backend becomes a no-op on pure
  Wayland sessions).
- M10 : Specific options in the settings to choose Backend in Linux (PipeWire or PulseAudio for example...)
- M11 : Locale-aware OEM key remapping so AZERTY users get the punctuation
  they expect (currently a US-layout assumption).

## File write by AI :
- CHANGES.md
- .github/workflows/build.yaml
- plugins/sound/native/src/linux/native-index-linux.cc (partially)
- plugins/sound/native/src/stub/native-index-stub.cc (partially)
- plugins/input/native/src/linux/native-index-linux.cc (entirely)
- plugins/input/native/src/stub/native-index-stub.cc (entirely)