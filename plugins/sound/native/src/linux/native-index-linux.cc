// Linux backend for castmate-plugin-sound-native.
//
// Provides the same JS surface as the Windows implementation by shelling out to
// `pactl` for audio device discovery and to `espeak-ng` for text-to-speech. `pactl`
// is the universal CLI for both PulseAudio and PipeWire (PipeWire ships a
// pipewire-pulse compatibility daemon), so the same code path works on either.
//
//   AudioDeviceInterface
//     - getDevices()            → pactl list sinks + sources
//     - getDefaultOutput(role)  → pactl info → Default Sink
//     - getDefaultInput(role)   → pactl info → Default Source
//     - emits device-added / removed / changed / default-{input,output}-changed
//       via a worker thread tailing `pactl subscribe`
//
//   OsTTSInterface
//     - getVoices()             → espeak-ng --voices
//     - speakToFile(...)        → espeak-ng -v VOICE -w FILE "TEXT" (forked)
//
// Linux has no Windows-style eMultimedia/eCommunications role split, so "main" and
// "chat" both resolve to the OS default. The user can change the default in their
// audio settings.

#include <napi.h>

#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <signal.h>
#include <fcntl.h>

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <string>
#include <sstream>
#include <thread>
#include <vector>

namespace {

// --- subprocess helpers ---------------------------------------------------------------

// Runs `cmd` via popen, returns stdout as a string. Empty string on failure.
std::string run_capture(const std::string& cmd) {
    FILE* f = popen(cmd.c_str(), "r");
    if (!f) return {};
    std::string out;
    char buf[1024];
    while (size_t n = std::fread(buf, 1, sizeof(buf), f)) {
        out.append(buf, n);
    }
    pclose(f);
    return out;
}

bool tool_available(const char* tool) {
    std::string cmd = std::string("command -v ") + tool + " >/dev/null 2>&1";
    return std::system(cmd.c_str()) == 0;
}

// --- pactl parsing --------------------------------------------------------------------

struct AudioDevice {
    std::string id;            // pactl Name (also used as guid; PA/PW has no GUID concept)
    std::string type;          // "input" | "output"
    std::string state;         // "active" | "unknown"
    std::string name;          // pactl Description
};

// Parses `pactl list sinks` or `pactl list sources`. Splits on blank lines, pulls
// State/Name/Description. Returns one AudioDevice per block.
std::vector<AudioDevice> parse_pactl_list(const std::string& output, const std::string& type) {
    std::vector<AudioDevice> devices;
    std::stringstream ss(output);
    std::string line;
    AudioDevice cur;
    bool in_block = false;

    auto starts_with = [](const std::string& s, const char* prefix) {
        return s.rfind(prefix, 0) == 0;
    };
    auto trim_left = [](std::string s) {
        size_t i = 0;
        while (i < s.size() && (s[i] == '\t' || s[i] == ' ')) i++;
        return s.substr(i);
    };
    auto map_state = [](const std::string& raw) {
        // PA reports RUNNING/IDLE/SUSPENDED. All mean "device exists and is usable";
        // the Windows shape only cares about active vs disconnected.
        if (raw == "RUNNING" || raw == "IDLE" || raw == "SUSPENDED") return "active";
        return "unknown";
    };
    auto flush = [&]() {
        if (in_block && !cur.id.empty()) {
            cur.type = type;
            devices.push_back(cur);
        }
        cur = AudioDevice{};
        in_block = false;
    };

    while (std::getline(ss, line)) {
        if (starts_with(line, "Sink #") || starts_with(line, "Source #")) {
            flush();
            in_block = true;
            continue;
        }
        if (!in_block) continue;

        const std::string body = trim_left(line);
        if (starts_with(body, "State: ")) {
            cur.state = map_state(body.substr(7));
        } else if (starts_with(body, "Name: ")) {
            cur.id = body.substr(6);
        } else if (starts_with(body, "Description: ")) {
            cur.name = body.substr(13);
        }
    }
    flush();
    return devices;
}

std::string pactl_default(const char* which /* "Sink" or "Source" */) {
    std::string info = run_capture("pactl info 2>/dev/null");
    std::stringstream ss(info);
    std::string line;
    std::string needle = std::string("Default ") + which + ": ";
    while (std::getline(ss, line)) {
        if (line.rfind(needle, 0) == 0) return line.substr(needle.size());
    }
    return {};
}

std::vector<AudioDevice> fetch_all_devices() {
    std::vector<AudioDevice> all;
    auto sinks = parse_pactl_list(run_capture("pactl list sinks 2>/dev/null"), "output");
    auto sources = parse_pactl_list(run_capture("pactl list sources 2>/dev/null"), "input");
    all.insert(all.end(), sinks.begin(), sinks.end());
    all.insert(all.end(), sources.begin(), sources.end());
    return all;
}

// --- JS conversion --------------------------------------------------------------------

Napi::Object device_to_js(Napi::Env env, const AudioDevice& d) {
    Napi::Object o = Napi::Object::New(env);
    o.Set("id", Napi::String::New(env, d.id));
    o.Set("type", Napi::String::New(env, d.type));
    o.Set("state", Napi::String::New(env, d.state));
    o.Set("name", Napi::String::New(env, d.name));
    // PA/PW have no Windows-style GUID; reuse the unique Name so JS code that keys on
    // either id or guid keeps a stable identifier.
    o.Set("guid", Napi::String::New(env, d.id));
    return o;
}

// --- audio_device_interface -----------------------------------------------------------

class audio_device_interface : public Napi::ObjectWrap<audio_device_interface> {
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports) {
        Napi::Function constructor = DefineClass(env, "NativeAudioDeviceInterface", {
            InstanceMethod("getDevices",       &audio_device_interface::get_devices),
            InstanceMethod("getDefaultOutput", &audio_device_interface::get_default_output),
            InstanceMethod("getDefaultInput",  &audio_device_interface::get_default_input),
        });
        exports.Set("NativeAudioDeviceInterface", constructor);
        return exports;
    }

    audio_device_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<audio_device_interface>(info)
    {
        if (info.Length() > 0 && info[0].IsFunction()) {
            emit_tsfn_ = Napi::ThreadSafeFunction::New(
                info.Env(), info[0].As<Napi::Function>(),
                "AudioDeviceEmit", 0, 1, this);
        }

        if (!tool_available("pactl")) {
            std::cerr << "[castmate-sound] `pactl` not found; audio device enumeration "
                         "will return empty results. Install pulseaudio-utils (apt) "
                         "or pipewire-pulse." << std::endl;
            return;
        }

        start_subscriber();
    }

    void Finalize(Napi::Env /*env*/) override {
        stop_subscriber();
        if (emit_tsfn_) {
            emit_tsfn_.Release();
            emit_tsfn_ = nullptr;
        }
    }

    Napi::Value get_devices(const Napi::CallbackInfo& info) {
        auto env = info.Env();
        auto devices = fetch_all_devices();
        Napi::Array arr = Napi::Array::New(env, devices.size());
        for (size_t i = 0; i < devices.size(); ++i) {
            arr.Set(static_cast<uint32_t>(i), device_to_js(env, devices[i]));
        }
        return arr;
    }

    Napi::Value get_default_output(const Napi::CallbackInfo& info) {
        return get_default_device(info, "Sink", "output");
    }
    Napi::Value get_default_input(const Napi::CallbackInfo& info) {
        return get_default_device(info, "Source", "input");
    }

private:
    Napi::Value get_default_device(const Napi::CallbackInfo& info, const char* which,
                                   const std::string& type) {
        // Linux/PA has a single default sink and a single default source — there is no
        // separate eCommunications role like Windows has, so "main" and "chat" both
        // resolve to the OS default. The `role` argument is therefore ignored.
        auto env = info.Env();
        std::string default_name = pactl_default(which);
        if (default_name.empty()) return env.Undefined();
        for (const auto& d : fetch_all_devices()) {
            if (d.type == type && d.id == default_name) return device_to_js(env, d);
        }
        return env.Undefined();
    }

    // ---- pactl subscribe worker -------------------------------------------------
    void start_subscriber() {
        if (sub_running_.load()) return;
        sub_running_.store(true);
        sub_thread_ = std::thread([this] { run_subscriber_loop(); });
    }

    void stop_subscriber() {
        if (!sub_running_.load()) return;
        sub_running_.store(false);
        // Kill the pactl subscribe child so its read returns immediately.
        if (sub_pid_ > 0) {
            kill(sub_pid_, SIGTERM);
        }
        if (sub_thread_.joinable()) sub_thread_.join();
        sub_pid_ = -1;
    }

    void run_subscriber_loop() {
        int pipefd[2];
        if (pipe(pipefd) != 0) {
            sub_running_.store(false);
            return;
        }
        pid_t pid = fork();
        if (pid < 0) {
            close(pipefd[0]);
            close(pipefd[1]);
            sub_running_.store(false);
            return;
        }
        if (pid == 0) {
            // child
            close(pipefd[0]);
            dup2(pipefd[1], STDOUT_FILENO);
            close(pipefd[1]);
            execlp("pactl", "pactl", "subscribe", static_cast<char*>(nullptr));
            _exit(127);
        }
        // parent
        close(pipefd[1]);
        sub_pid_ = pid;

        FILE* in = fdopen(pipefd[0], "r");
        if (!in) {
            sub_running_.store(false);
            close(pipefd[0]);
            return;
        }

        char* line = nullptr;
        size_t cap = 0;
        std::string prev_default_sink = pactl_default("Sink");
        std::string prev_default_source = pactl_default("Source");

        while (sub_running_.load()) {
            ssize_t n = getline(&line, &cap, in);
            if (n <= 0) break;
            std::string ev(line, n);

            // pactl subscribe output format examples:
            //   Event 'new' on sink #42
            //   Event 'remove' on source #18
            //   Event 'change' on server
            const bool is_sink = ev.find(" on sink") != std::string::npos;
            const bool is_source = ev.find(" on source") != std::string::npos;
            const bool is_server = ev.find(" on server") != std::string::npos;

            if (ev.find("'new'") != std::string::npos && (is_sink || is_source)) {
                emit_devices_changed("device-added", is_sink ? "output" : "input");
            } else if (ev.find("'remove'") != std::string::npos && (is_sink || is_source)) {
                emit_devices_changed("device-removed", is_sink ? "output" : "input");
            } else if (ev.find("'change'") != std::string::npos && (is_sink || is_source)) {
                emit_devices_changed("device-changed", is_sink ? "output" : "input");
            } else if (is_server) {
                // Server change can mean default device changed; re-query and diff.
                std::string ds = pactl_default("Sink");
                std::string dsr = pactl_default("Source");
                if (ds != prev_default_sink) {
                    prev_default_sink = ds;
                    emit_default_changed("default-output-changed", ds);
                }
                if (dsr != prev_default_source) {
                    prev_default_source = dsr;
                    emit_default_changed("default-input-changed", dsr);
                }
            }
        }
        if (line) free(line);
        fclose(in);

        int status = 0;
        waitpid(pid, &status, 0);
    }

    void emit_devices_changed(const std::string& event_name, const std::string& expect_type) {
        if (!emit_tsfn_) return;
        // For added/changed, fetch the updated device list and find a matching device
        // to forward. Cheaper than parsing the event line for IDs.
        std::vector<AudioDevice> snapshot = fetch_all_devices();
        emit_tsfn_.NonBlockingCall(
            [event_name, expect_type, snapshot = std::move(snapshot)]
            (Napi::Env env, Napi::Function js_callback) mutable {
                if (env == nullptr || js_callback == nullptr) return;
                if (event_name == "device-removed") {
                    // We don't know which exact id was removed without diffing snapshots;
                    // pass an empty id and let JS reconcile by re-querying getDevices().
                    js_callback.Call({Napi::String::New(env, event_name),
                                      Napi::String::New(env, "")});
                    return;
                }
                for (const auto& d : snapshot) {
                    if (d.type == expect_type) {
                        js_callback.Call({Napi::String::New(env, event_name),
                                          device_to_js(env, d)});
                        return;
                    }
                }
            });
    }

    void emit_default_changed(const std::string& event_name, const std::string& id) {
        if (!emit_tsfn_) return;
        std::vector<AudioDevice> snapshot = fetch_all_devices();
        std::string type = (event_name == "default-output-changed") ? "output" : "input";
        emit_tsfn_.NonBlockingCall(
            [event_name, type, id, snapshot = std::move(snapshot)]
            (Napi::Env env, Napi::Function js_callback) mutable {
                if (env == nullptr || js_callback == nullptr) return;
                for (const auto& d : snapshot) {
                    if (d.id == id && d.type == type) {
                        // Windows shape is (role, device); we pass "main" since Linux
                        // has only one default role.
                        js_callback.Call({Napi::String::New(env, event_name),
                                          Napi::String::New(env, "main"),
                                          device_to_js(env, d)});
                        return;
                    }
                }
            });
    }

    Napi::ThreadSafeFunction emit_tsfn_;
    std::thread sub_thread_;
    std::atomic<bool> sub_running_{false};
    pid_t sub_pid_ = -1;
};

// --- os_tts_interface (espeak-ng wrapper) ---------------------------------------------

class TTSWorker : public Napi::AsyncWorker {
public:
    TTSWorker(Napi::Function& callback, std::string voice, std::string text, std::string outfile)
        : Napi::AsyncWorker(callback),
          voice_(std::move(voice)),
          text_(std::move(text)),
          outfile_(std::move(outfile)) {}

    void Execute() override {
        pid_t pid = fork();
        if (pid < 0) {
            SetError("fork() failed");
            return;
        }
        if (pid == 0) {
            // child — argv style, no shell so no injection risk on `text_`.
            std::vector<const char*> argv;
            argv.push_back("espeak-ng");
            if (!voice_.empty()) {
                argv.push_back("-v");
                argv.push_back(voice_.c_str());
            }
            argv.push_back("-w");
            argv.push_back(outfile_.c_str());
            argv.push_back("--");
            argv.push_back(text_.c_str());
            argv.push_back(nullptr);
            // stderr stays attached so espeak-ng's "voice does not exist" message ends
            // up in CastMate's log; stdout to /dev/null because espeak prints the text
            // to stdout when synthesizing.
            int devnull = open("/dev/null", O_WRONLY);
            if (devnull >= 0) {
                dup2(devnull, STDOUT_FILENO);
                close(devnull);
            }
            execvp("espeak-ng", const_cast<char* const*>(argv.data()));
            // execvp failed → try the legacy "espeak" name before giving up.
            argv[0] = "espeak";
            execvp("espeak", const_cast<char* const*>(argv.data()));
            _exit(127);
        }
        int status = 0;
        waitpid(pid, &status, 0);
        if (WIFEXITED(status) && WEXITSTATUS(status) == 0) return;
        if (WIFEXITED(status) && WEXITSTATUS(status) == 127) {
            SetError("espeak-ng (or espeak) not found — install it with your package manager.");
            return;
        }
        SetError("espeak failed (likely unknown voice \"" + voice_ +
                 "\") with status " + std::to_string(status));
    }

    void OnOK() override {
        Napi::HandleScope scope(Env());
        Callback().Call({Env().Null()});
    }
    void OnError(const Napi::Error& e) override {
        Napi::HandleScope scope(Env());
        Callback().Call({Napi::String::New(Env(), e.Message())});
    }

private:
    std::string voice_;
    std::string text_;
    std::string outfile_;
};

class os_tts_interface : public Napi::ObjectWrap<os_tts_interface> {
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports) {
        Napi::Function constructor = DefineClass(env, "OsTTSInterface", {
            InstanceMethod("getVoices",   &os_tts_interface::get_voices),
            InstanceMethod("speakToFile", &os_tts_interface::speak_to_file),
        });
        exports.Set("OsTTSInterface", constructor);
        return exports;
    }

    os_tts_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<os_tts_interface>(info) {}

    Napi::Value get_voices(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        Napi::Array result = Napi::Array::New(env);
        if (!tool_available("espeak-ng") && !tool_available("espeak")) {
            return result;
        }

        const char* cmd = tool_available("espeak-ng")
                              ? "espeak-ng --voices 2>/dev/null"
                              : "espeak --voices 2>/dev/null";
        std::string out = run_capture(cmd);

        // espeak-ng --voices output is a *fixed-width* table, not whitespace-separated:
        //
        //   Pty Language       Age/Gender VoiceName          File                 Other Languages
        //    5  af              --/M      Afrikaans          gmw/af
        //    5  en-029          --/M      English (Caribbean) gmw/en-029  (en 9)(en-us 9)
        //
        // VoiceName can contain spaces ("English (Caribbean)") so word-tokenizing breaks.
        // Locate column starts from the header line, then substring each data row.
        // The "File" column value is what `-v` actually accepts; the "VoiceName" column
        // is the human-readable label.
        std::stringstream ss(out);
        std::string line;
        size_t col_name = std::string::npos;
        size_t col_file = std::string::npos;
        size_t col_other = std::string::npos;
        uint32_t idx = 0;

        auto trim = [](std::string s) {
            while (!s.empty() && (s.front() == ' ' || s.front() == '\t')) s.erase(0, 1);
            while (!s.empty() && (s.back() == ' ' || s.back() == '\t')) s.pop_back();
            return s;
        };

        while (std::getline(ss, line)) {
            if (col_file == std::string::npos) {
                size_t pn = line.find("VoiceName");
                size_t pf = line.find("File");
                if (pn != std::string::npos && pf != std::string::npos) {
                    col_name = pn;
                    col_file = pf;
                    size_t po = line.find("Other Languages");
                    col_other = (po != std::string::npos) ? po : std::string::npos;
                }
                continue;
            }
            if (line.size() <= col_file) continue;

            std::string name_val = trim(line.substr(col_name, col_file - col_name));
            size_t end = (col_other != std::string::npos && line.size() > col_other)
                             ? col_other
                             : line.size();
            std::string file_val = trim(line.substr(col_file, end - col_file));
            if (name_val.empty() || file_val.empty()) continue;

            Napi::Object v = Napi::Object::New(env);
            v.Set("id", Napi::String::New(env, file_val));    // -v argument to espeak-ng
            v.Set("name", Napi::String::New(env, name_val));  // display label
            result.Set(idx++, v);
        }
        return result;
    }

    Napi::Value speak_to_file(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 4 || !info[3].IsFunction()) {
            return Napi::Boolean::New(env, false);
        }
        std::string message  = info[0].As<Napi::String>().Utf8Value();
        std::string filename = info[1].As<Napi::String>().Utf8Value();
        std::string voice_id = info[2].IsString() ? info[2].As<Napi::String>().Utf8Value() : "";
        Napi::Function cb = info[3].As<Napi::Function>();

        if (!tool_available("espeak-ng") && !tool_available("espeak")) {
            cb.Call(env.Global(), {Napi::String::New(env, "espeak-ng not installed")});
            return Napi::Boolean::New(env, false);
        }

        auto* worker = new TTSWorker(cb, voice_id, message, filename);
        worker->Queue();
        return Napi::Boolean::New(env, true);
    }
};

}  // namespace

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    audio_device_interface::init(env, exports);
    os_tts_interface::init(env, exports);
    return exports;
}

NODE_API_MODULE(castmate_plugin_sound_native, Init)
