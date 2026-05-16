// Linux backend for castmate-plugin-input-native.
//
// Provides the same JS surface as the Windows implementation (NativeInputInterface
// with simulateKey*, simulateMouse*, startEvents, stopEvents, isKeyDown) using:
//
//   - libXtst (XTest)  for keyboard/mouse simulation
//   - XQueryKeymap     polled on a worker thread for key-pressed/key-released events
//
// Wayland-native sessions without XWayland have no XTest backend; on those, XOpenDisplay
// returns NULL and the interface becomes a structured no-op (logs a one-time warning).
//
// The JS layer speaks Windows virtual-key codes. mapVkToKeysym() / mapKeysymToVk() do
// the round-trip; only keysyms we know about are forwarded — unknown VKs are silently
// dropped instead of guessing.

#include <napi.h>

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/keysym.h>
#include <X11/extensions/XTest.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <iostream>
#include <mutex>
#include <thread>
#include <unordered_map>

namespace {

// --- Windows VK → X11 KeySym ----------------------------------------------------------
// Microsoft virtual-key reference: https://learn.microsoft.com/windows/win32/inputdev/virtual-key-codes
struct VkKeysym { uint32_t vk; KeySym ks; };

const VkKeysym VK_KEYSYM_TABLE[] = {
    {0x08, XK_BackSpace}, {0x09, XK_Tab},        {0x0D, XK_Return},
    {0x10, XK_Shift_L},   {0x11, XK_Control_L},  {0x12, XK_Alt_L},
    {0x13, XK_Pause},     {0x14, XK_Caps_Lock},  {0x1B, XK_Escape},
    {0x20, XK_space},     {0x21, XK_Prior},      {0x22, XK_Next},
    {0x23, XK_End},       {0x24, XK_Home},       {0x25, XK_Left},
    {0x26, XK_Up},        {0x27, XK_Right},      {0x28, XK_Down},
    {0x2C, XK_Print},     {0x2D, XK_Insert},     {0x2E, XK_Delete},

    // 0-9 share top-row keysyms with ASCII '0'..'9'
    {0x30, XK_0}, {0x31, XK_1}, {0x32, XK_2}, {0x33, XK_3}, {0x34, XK_4},
    {0x35, XK_5}, {0x36, XK_6}, {0x37, XK_7}, {0x38, XK_8}, {0x39, XK_9},

    // A-Z map to lowercase keysyms (XTest presses the physical key, modifiers separate)
    {0x41, XK_a}, {0x42, XK_b}, {0x43, XK_c}, {0x44, XK_d}, {0x45, XK_e},
    {0x46, XK_f}, {0x47, XK_g}, {0x48, XK_h}, {0x49, XK_i}, {0x4A, XK_j},
    {0x4B, XK_k}, {0x4C, XK_l}, {0x4D, XK_m}, {0x4E, XK_n}, {0x4F, XK_o},
    {0x50, XK_p}, {0x51, XK_q}, {0x52, XK_r}, {0x53, XK_s}, {0x54, XK_t},
    {0x55, XK_u}, {0x56, XK_v}, {0x57, XK_w}, {0x58, XK_x}, {0x59, XK_y},
    {0x5A, XK_z},

    {0x5B, XK_Super_L}, {0x5C, XK_Super_R}, {0x5D, XK_Menu},

    // Numpad
    {0x60, XK_KP_0}, {0x61, XK_KP_1}, {0x62, XK_KP_2}, {0x63, XK_KP_3}, {0x64, XK_KP_4},
    {0x65, XK_KP_5}, {0x66, XK_KP_6}, {0x67, XK_KP_7}, {0x68, XK_KP_8}, {0x69, XK_KP_9},
    {0x6A, XK_KP_Multiply}, {0x6B, XK_KP_Add},      {0x6C, XK_KP_Separator},
    {0x6D, XK_KP_Subtract}, {0x6E, XK_KP_Decimal},  {0x6F, XK_KP_Divide},

    // Function keys F1-F24
    {0x70, XK_F1},  {0x71, XK_F2},  {0x72, XK_F3},  {0x73, XK_F4},
    {0x74, XK_F5},  {0x75, XK_F6},  {0x76, XK_F7},  {0x77, XK_F8},
    {0x78, XK_F9},  {0x79, XK_F10}, {0x7A, XK_F11}, {0x7B, XK_F12},
    {0x7C, XK_F13}, {0x7D, XK_F14}, {0x7E, XK_F15}, {0x7F, XK_F16},
    {0x80, XK_F17}, {0x81, XK_F18}, {0x82, XK_F19}, {0x83, XK_F20},
    {0x84, XK_F21}, {0x85, XK_F22}, {0x86, XK_F23}, {0x87, XK_F24},

    {0x90, XK_Num_Lock},  {0x91, XK_Scroll_Lock},
    {0xA0, XK_Shift_L},   {0xA1, XK_Shift_R},
    {0xA2, XK_Control_L}, {0xA3, XK_Control_R},
    {0xA4, XK_Alt_L},     {0xA5, XK_Alt_R},

    // OEM punctuation (US layout assumed; users on other layouts may see remapping)
    {0xBA, XK_semicolon},  {0xBB, XK_equal},    {0xBC, XK_comma},
    {0xBD, XK_minus},      {0xBE, XK_period},   {0xBF, XK_slash},
    {0xC0, XK_grave},      {0xDB, XK_bracketleft},
    {0xDC, XK_backslash},  {0xDD, XK_bracketright},
    {0xDE, XK_apostrophe},
};

KeySym mapVkToKeysym(uint32_t vk) {
    for (const auto& e : VK_KEYSYM_TABLE) {
        if (e.vk == vk) return e.ks;
    }
    return NoSymbol;
}

// Reverse lookup, built lazily on first call.
std::unordered_map<KeySym, uint32_t>& keysymToVkMap() {
    static std::unordered_map<KeySym, uint32_t> map = [] {
        std::unordered_map<KeySym, uint32_t> m;
        for (const auto& e : VK_KEYSYM_TABLE) {
            m.emplace(e.ks, e.vk);
        }
        return m;
    }();
    return map;
}

uint32_t mapKeysymToVk(KeySym ks) {
    const auto& m = keysymToVkMap();
    auto it = m.find(ks);
    return it == m.end() ? 0 : it->second;
}

// --- input_interface class ------------------------------------------------------------
class input_interface : public Napi::ObjectWrap<input_interface> {
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports) {
        Napi::Function constructor = DefineClass(env, "NativeInputInterface", {
            InstanceMethod("simulateKeyDown",   &input_interface::simulate_key_down),
            InstanceMethod("simulateKeyUp",     &input_interface::simulate_key_up),
            InstanceMethod("simulateMouseDown", &input_interface::simulate_mouse_down),
            InstanceMethod("simulateMouseUp",   &input_interface::simulate_mouse_up),
            InstanceMethod("startEvents",       &input_interface::start_events),
            InstanceMethod("stopEvents",        &input_interface::stop_events),
            InstanceMethod("isKeyDown",         &input_interface::is_key_down),
        });
        exports.Set("NativeInputInterface", constructor);
        return exports;
    }

    input_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<input_interface>(info)
    {
        std::memset(key_states_, 0, sizeof(key_states_));

        // One display for the JS thread (key/mouse simulation). The poller thread, if
        // started, opens its own connection.
        display_ = XOpenDisplay(nullptr);
        if (!display_) {
            std::cerr << "[castmate-input] XOpenDisplay failed — no X11 / XWayland session detected, "
                         "input simulation will be a no-op." << std::endl;
        } else {
            int event_base, error_base, major, minor;
            if (!XTestQueryExtension(display_, &event_base, &error_base, &major, &minor)) {
                std::cerr << "[castmate-input] XTest extension not available — "
                             "input simulation will be a no-op." << std::endl;
                XCloseDisplay(display_);
                display_ = nullptr;
            }
        }

        // Bound JS emit function gets handed in by the JS wrapper.
        if (info.Length() > 0 && info[0].IsFunction()) {
            emit_tsfn_ = Napi::ThreadSafeFunction::New(
                info.Env(), info[0].As<Napi::Function>(), "InputInterfaceEmit",
                0, 1, this);
        }
    }

    void Finalize(Napi::Env /*env*/) override {
        stop_polling_locked();
        if (display_) {
            XCloseDisplay(display_);
            display_ = nullptr;
        }
        if (emit_tsfn_) {
            emit_tsfn_.Release();
            emit_tsfn_ = nullptr;
        }
    }

    // ---- Simulation -----------------------------------------------------------------
    Napi::Value simulate_key_down(const Napi::CallbackInfo& info) {
        return simulate_key(info, true);
    }
    Napi::Value simulate_key_up(const Napi::CallbackInfo& info) {
        return simulate_key(info, false);
    }

    Napi::Value simulate_mouse_down(const Napi::CallbackInfo& info) {
        return simulate_mouse(info, true);
    }
    Napi::Value simulate_mouse_up(const Napi::CallbackInfo& info) {
        return simulate_mouse(info, false);
    }

    Napi::Value is_key_down(const Napi::CallbackInfo& info) {
        uint32_t vk = info[0].As<Napi::Number>().Uint32Value();
        if (vk > 255) return Napi::Boolean::New(info.Env(), false);
        return Napi::Boolean::New(info.Env(), key_states_[vk]);
    }

    // ---- Event capture --------------------------------------------------------------
    Napi::Value start_events(const Napi::CallbackInfo& info) {
        std::lock_guard<std::mutex> lk(poll_mutex_);
        if (poll_running_.load()) return info.Env().Undefined();
        if (!display_) return info.Env().Undefined();

        poll_running_.store(true);
        poll_thread_ = std::thread([this] { run_polling_loop(); });
        return info.Env().Undefined();
    }

    Napi::Value stop_events(const Napi::CallbackInfo& info) {
        std::lock_guard<std::mutex> lk(poll_mutex_);
        stop_polling_locked();
        return info.Env().Undefined();
    }

private:
    Napi::Value simulate_key(const Napi::CallbackInfo& info, bool is_press) {
        if (!display_) return info.Env().Undefined();
        uint32_t vk = info[0].As<Napi::Number>().Uint32Value();
        KeySym ks = mapVkToKeysym(vk);
        if (ks == NoSymbol) return info.Env().Undefined();
        KeyCode kc = XKeysymToKeycode(display_, ks);
        if (kc == 0) return info.Env().Undefined();
        XTestFakeKeyEvent(display_, kc, is_press ? True : False, 0);
        XFlush(display_);
        return info.Env().Undefined();
    }

    Napi::Value simulate_mouse(const Napi::CallbackInfo& info, bool is_press) {
        if (!display_) return info.Env().Undefined();
        std::string button = info[0].As<Napi::String>().Utf8Value();
        unsigned int x_button = 0;
        if      (button == "left")   x_button = 1;
        else if (button == "middle") x_button = 2;
        else if (button == "right")  x_button = 3;
        else if (button == "mouse4") x_button = 8;  // X11 convention: back
        else if (button == "mouse5") x_button = 9;  // X11 convention: forward
        else return info.Env().Undefined();
        XTestFakeButtonEvent(display_, x_button, is_press ? True : False, 0);
        XFlush(display_);
        return info.Env().Undefined();
    }

    // ---- Polling thread -------------------------------------------------------------
    void run_polling_loop() {
        Display* poll_display = XOpenDisplay(nullptr);
        if (!poll_display) {
            poll_running_.store(false);
            return;
        }

        char prev_keymap[32] = {0};
        char cur_keymap[32];

        // Build a keycode→keysym snapshot once; X server rebuilds it on layout changes
        // but for hotkey reporting the initial mapping is good enough.
        int min_kc = 0, max_kc = 0;
        XDisplayKeycodes(poll_display, &min_kc, &max_kc);
        int keysyms_per_kc = 0;
        KeySym* keysyms_table = XGetKeyboardMapping(
            poll_display, static_cast<KeyCode>(min_kc),
            max_kc - min_kc + 1, &keysyms_per_kc);

        while (poll_running_.load()) {
            XQueryKeymap(poll_display, cur_keymap);

            for (int kc = min_kc; kc <= max_kc && poll_running_.load(); ++kc) {
                bool was = (prev_keymap[kc / 8] >> (kc % 8)) & 1;
                bool now = (cur_keymap[kc / 8]  >> (kc % 8)) & 1;
                if (was == now) continue;

                KeySym ks = keysyms_table[(kc - min_kc) * keysyms_per_kc];
                uint32_t vk = mapKeysymToVk(ks);
                if (vk == 0) continue;  // unmapped key, skip

                if (vk < 256) key_states_[vk] = now;
                emit_key_event(vk, now);
            }

            std::memcpy(prev_keymap, cur_keymap, sizeof(prev_keymap));
            std::this_thread::sleep_for(std::chrono::milliseconds(33));  // ~30 Hz
        }

        if (keysyms_table) XFree(keysyms_table);
        XCloseDisplay(poll_display);
    }

    void emit_key_event(uint32_t vk, bool pressed) {
        if (!emit_tsfn_) return;
        const char* event_name = pressed ? "key-pressed" : "key-released";
        emit_tsfn_.NonBlockingCall([event_name, vk](Napi::Env env, Napi::Function js_callback) {
            if (env == nullptr || js_callback == nullptr) return;
            js_callback.Call({Napi::String::New(env, event_name), Napi::Number::New(env, vk)});
        });
    }

    // Caller must hold poll_mutex_.
    void stop_polling_locked() {
        if (!poll_running_.load()) return;
        poll_running_.store(false);
        if (poll_thread_.joinable()) poll_thread_.join();
    }

    Display* display_ = nullptr;
    Napi::ThreadSafeFunction emit_tsfn_;

    std::thread poll_thread_;
    std::mutex poll_mutex_;
    std::atomic<bool> poll_running_{false};

    bool key_states_[256];
};

}  // namespace

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    input_interface::init(env, exports);
    return exports;
}

NODE_API_MODULE(castmate_plugin_input_native, Init)
