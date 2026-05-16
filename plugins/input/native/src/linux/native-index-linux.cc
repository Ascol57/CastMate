// Linux backend for castmate-plugin-input-native.
//
// Exposes the same JS surface as the Windows implementation (NativeInputInterface
// with simulateKey*, simulateMouse*, startEvents, stopEvents, isKeyDown) using
// two interchangeable backends selected automatically at construction time:
//
//   1. X11 + XTest (libX11 / libXtst)
//      Preferred when a DISPLAY is reachable (Xorg sessions and any Wayland
//      session with XWayland enabled, which is the default on Ubuntu/Fedora/
//      Debian GNOME). Also enables global key-event capture via XQueryKeymap
//      polling.
//
//   2. /dev/uinput (Linux kernel virtual-device API)
//      Fallback when XOpenDisplay fails — typically pure Wayland sessions
//      without XWayland. Works on every Wayland compositor because uinput
//      operates below the display protocol. Limited to *simulation*: global
//      event capture on Wayland would require reading /dev/input/event*
//      directly (root-only) and is not part of this backend.
//
// If neither backend is usable (no DISPLAY and `/dev/uinput` not writable), the
// interface becomes a no-op and logs a one-time explanation to stderr.

#include <napi.h>

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/keysym.h>
#include <X11/extensions/XTest.h>

#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <sys/ioctl.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>

namespace {

// =====================================================================================
// Windows VK ↔ X11 KeySym table (used by the X11 backend for both directions)
// =====================================================================================
struct VkKeysym { uint32_t vk; KeySym ks; };

const VkKeysym VK_KEYSYM_TABLE[] = {
    {0x08, XK_BackSpace}, {0x09, XK_Tab},        {0x0D, XK_Return},
    {0x10, XK_Shift_L},   {0x11, XK_Control_L},  {0x12, XK_Alt_L},
    {0x13, XK_Pause},     {0x14, XK_Caps_Lock},  {0x1B, XK_Escape},
    {0x20, XK_space},     {0x21, XK_Prior},      {0x22, XK_Next},
    {0x23, XK_End},       {0x24, XK_Home},       {0x25, XK_Left},
    {0x26, XK_Up},        {0x27, XK_Right},      {0x28, XK_Down},
    {0x2C, XK_Print},     {0x2D, XK_Insert},     {0x2E, XK_Delete},

    {0x30, XK_0}, {0x31, XK_1}, {0x32, XK_2}, {0x33, XK_3}, {0x34, XK_4},
    {0x35, XK_5}, {0x36, XK_6}, {0x37, XK_7}, {0x38, XK_8}, {0x39, XK_9},

    {0x41, XK_a}, {0x42, XK_b}, {0x43, XK_c}, {0x44, XK_d}, {0x45, XK_e},
    {0x46, XK_f}, {0x47, XK_g}, {0x48, XK_h}, {0x49, XK_i}, {0x4A, XK_j},
    {0x4B, XK_k}, {0x4C, XK_l}, {0x4D, XK_m}, {0x4E, XK_n}, {0x4F, XK_o},
    {0x50, XK_p}, {0x51, XK_q}, {0x52, XK_r}, {0x53, XK_s}, {0x54, XK_t},
    {0x55, XK_u}, {0x56, XK_v}, {0x57, XK_w}, {0x58, XK_x}, {0x59, XK_y},
    {0x5A, XK_z},

    {0x5B, XK_Super_L}, {0x5C, XK_Super_R}, {0x5D, XK_Menu},

    {0x60, XK_KP_0}, {0x61, XK_KP_1}, {0x62, XK_KP_2}, {0x63, XK_KP_3}, {0x64, XK_KP_4},
    {0x65, XK_KP_5}, {0x66, XK_KP_6}, {0x67, XK_KP_7}, {0x68, XK_KP_8}, {0x69, XK_KP_9},
    {0x6A, XK_KP_Multiply}, {0x6B, XK_KP_Add},      {0x6C, XK_KP_Separator},
    {0x6D, XK_KP_Subtract}, {0x6E, XK_KP_Decimal},  {0x6F, XK_KP_Divide},

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

    // OEM punctuation, US canonical. The XTest backend translates these via
    // XKeysymToKeycode → that lookup is dynamic against the active xkb layout,
    // so on any layout the user's actual `;` key (whatever its physical position)
    // is pressed when CastMate asks for VK_OEM_1. See M11 notes in CHANGES.md.
    {0xBA, XK_semicolon},  {0xBB, XK_equal},    {0xBC, XK_comma},
    {0xBD, XK_minus},      {0xBE, XK_period},   {0xBF, XK_slash},
    {0xC0, XK_grave},      {0xDB, XK_bracketleft},
    {0xDC, XK_backslash},  {0xDD, XK_bracketright},
    {0xDE, XK_apostrophe},
};

KeySym mapVkToKeysym(uint32_t vk) {
    for (const auto& e : VK_KEYSYM_TABLE) if (e.vk == vk) return e.ks;
    return NoSymbol;
}

uint32_t mapKeysymToVk(KeySym ks) {
    static const std::unordered_map<KeySym, uint32_t> map = [] {
        std::unordered_map<KeySym, uint32_t> m;
        for (const auto& e : VK_KEYSYM_TABLE) m.emplace(e.ks, e.vk);
        return m;
    }();
    auto it = map.find(ks);
    return it == map.end() ? 0 : it->second;
}

uint32_t mapVkToLinuxKey(uint32_t vk);  // forward decl — body defined below.

// Inverse of mapVkToLinuxKey — given a kernel scancode (KEY_*), return the Windows
// VK that names that physical position. Built lazily by walking the full VK range.
// Used as a fallback in the X11 polling thread: when the active xkb layout produces
// a keysym we don't recognize (e.g. AZERTY's `é`, German `ä`, Cyrillic letters), we
// still report the physical-position VK so hotkey bindings work on any keyboard.
uint32_t mapLinuxKeyToVk(uint32_t scancode) {
    static const std::unordered_map<uint32_t, uint32_t> map = [] {
        std::unordered_map<uint32_t, uint32_t> m;
        for (uint32_t vk = 0; vk <= 0xFF; ++vk) {
            uint32_t k = mapVkToLinuxKey(vk);
            // First write wins. mapVkToLinuxKey collapses 0x10/0xA0 and 0x11/0xA2 to the
            // same kernel code; we want the simpler VK to take precedence in the inverse
            // direction so a left-shift keypress reports VK_SHIFT (0x10) rather than
            // VK_LSHIFT (0xA0).
            if (k != 0 && m.find(k) == m.end()) m.emplace(k, vk);
        }
        return m;
    }();
    auto it = map.find(scancode);
    return it == map.end() ? 0 : it->second;
}

// =====================================================================================
// Windows VK → Linux KEY_* code table (used by the uinput backend AND the X11
// backend's fast path — see X11Backend::key)
// =====================================================================================
// Kernel scancodes are layout-INDEPENDENT: KEY_A always names the same physical
// hardware position regardless of which xkb layout the user has loaded. The
// character produced when that scancode is interpreted by Xorg / a Wayland
// compositor depends on the active layout — which is exactly the right behavior
// for input simulation. CastMate sends "press this physical position" and the
// running session decides what character that is on this user's keyboard.
uint32_t mapVkToLinuxKey(uint32_t vk) {
    switch (vk) {
        // Basic editing
        case 0x08: return KEY_BACKSPACE;
        case 0x09: return KEY_TAB;
        case 0x0D: return KEY_ENTER;
        case 0x13: return KEY_PAUSE;
        case 0x14: return KEY_CAPSLOCK;
        case 0x1B: return KEY_ESC;
        case 0x20: return KEY_SPACE;

        // Navigation
        case 0x21: return KEY_PAGEUP;
        case 0x22: return KEY_PAGEDOWN;
        case 0x23: return KEY_END;
        case 0x24: return KEY_HOME;
        case 0x25: return KEY_LEFT;
        case 0x26: return KEY_UP;
        case 0x27: return KEY_RIGHT;
        case 0x28: return KEY_DOWN;
        case 0x2C: return KEY_SYSRQ;       // Print Screen
        case 0x2D: return KEY_INSERT;
        case 0x2E: return KEY_DELETE;

        // Modifiers — left variants by default, separate VKs for L/R
        case 0x10: case 0xA0: return KEY_LEFTSHIFT;
        case 0xA1: return KEY_RIGHTSHIFT;
        case 0x11: case 0xA2: return KEY_LEFTCTRL;
        case 0xA3: return KEY_RIGHTCTRL;
        case 0x12: case 0xA4: return KEY_LEFTALT;
        case 0xA5: return KEY_RIGHTALT;
        case 0x5B: return KEY_LEFTMETA;    // Super_L
        case 0x5C: return KEY_RIGHTMETA;
        case 0x5D: return KEY_MENU;
        case 0x90: return KEY_NUMLOCK;
        case 0x91: return KEY_SCROLLLOCK;

        // Digits 0..9 — VK ordering ('0'=0x30) does not match kernel layout
        // (KEY_1=2, KEY_2=3, ..., KEY_0=11), so map explicitly.
        case 0x30: return KEY_0;
        case 0x31: return KEY_1;
        case 0x32: return KEY_2;
        case 0x33: return KEY_3;
        case 0x34: return KEY_4;
        case 0x35: return KEY_5;
        case 0x36: return KEY_6;
        case 0x37: return KEY_7;
        case 0x38: return KEY_8;
        case 0x39: return KEY_9;

        // Letters A..Z — VK ordering ('A'=0x41) does not match kernel layout
        // (which orders by physical position: Q=16, W=17, A=30, …), so map
        // each one explicitly.
        case 0x41: return KEY_A; case 0x42: return KEY_B; case 0x43: return KEY_C;
        case 0x44: return KEY_D; case 0x45: return KEY_E; case 0x46: return KEY_F;
        case 0x47: return KEY_G; case 0x48: return KEY_H; case 0x49: return KEY_I;
        case 0x4A: return KEY_J; case 0x4B: return KEY_K; case 0x4C: return KEY_L;
        case 0x4D: return KEY_M; case 0x4E: return KEY_N; case 0x4F: return KEY_O;
        case 0x50: return KEY_P; case 0x51: return KEY_Q; case 0x52: return KEY_R;
        case 0x53: return KEY_S; case 0x54: return KEY_T; case 0x55: return KEY_U;
        case 0x56: return KEY_V; case 0x57: return KEY_W; case 0x58: return KEY_X;
        case 0x59: return KEY_Y; case 0x5A: return KEY_Z;

        // Numpad
        case 0x60: return KEY_KP0; case 0x61: return KEY_KP1; case 0x62: return KEY_KP2;
        case 0x63: return KEY_KP3; case 0x64: return KEY_KP4; case 0x65: return KEY_KP5;
        case 0x66: return KEY_KP6; case 0x67: return KEY_KP7; case 0x68: return KEY_KP8;
        case 0x69: return KEY_KP9;
        case 0x6A: return KEY_KPASTERISK;
        case 0x6B: return KEY_KPPLUS;
        case 0x6D: return KEY_KPMINUS;
        case 0x6E: return KEY_KPDOT;
        case 0x6F: return KEY_KPSLASH;

        // Function keys
        case 0x70: return KEY_F1;  case 0x71: return KEY_F2;  case 0x72: return KEY_F3;
        case 0x73: return KEY_F4;  case 0x74: return KEY_F5;  case 0x75: return KEY_F6;
        case 0x76: return KEY_F7;  case 0x77: return KEY_F8;  case 0x78: return KEY_F9;
        case 0x79: return KEY_F10; case 0x7A: return KEY_F11; case 0x7B: return KEY_F12;
        case 0x7C: return KEY_F13; case 0x7D: return KEY_F14; case 0x7E: return KEY_F15;
        case 0x7F: return KEY_F16; case 0x80: return KEY_F17; case 0x81: return KEY_F18;
        case 0x82: return KEY_F19; case 0x83: return KEY_F20; case 0x84: return KEY_F21;
        case 0x85: return KEY_F22; case 0x86: return KEY_F23; case 0x87: return KEY_F24;

        // OEM punctuation (US layout assumption — same caveat as the XTest path)
        case 0xBA: return KEY_SEMICOLON;
        case 0xBB: return KEY_EQUAL;
        case 0xBC: return KEY_COMMA;
        case 0xBD: return KEY_MINUS;
        case 0xBE: return KEY_DOT;
        case 0xBF: return KEY_SLASH;
        case 0xC0: return KEY_GRAVE;
        case 0xDB: return KEY_LEFTBRACE;
        case 0xDC: return KEY_BACKSLASH;
        case 0xDD: return KEY_RIGHTBRACE;
        case 0xDE: return KEY_APOSTROPHE;

        default: return 0;
    }
}

// =====================================================================================
// Backend interface
// =====================================================================================
class IInputBackend {
public:
    virtual ~IInputBackend() = default;
    virtual const char* name() const = 0;
    virtual void key(uint32_t vk, bool press) = 0;
    virtual void mouse(const std::string& button, bool press) = 0;
};

// =====================================================================================
// XTest backend (X11)
// =====================================================================================
class X11Backend final : public IInputBackend {
public:
    static std::unique_ptr<X11Backend> try_open() {
        Display* d = XOpenDisplay(nullptr);
        if (!d) return nullptr;
        int eb, errb, maj, min;
        if (!XTestQueryExtension(d, &eb, &errb, &maj, &min)) {
            XCloseDisplay(d);
            return nullptr;
        }
        return std::unique_ptr<X11Backend>(new X11Backend(d));
    }

    ~X11Backend() override {
        if (display_) XCloseDisplay(display_);
    }

    const char* name() const override { return "X11/XTest"; }

    void key(uint32_t vk, bool press) override {
        KeySym ks = mapVkToKeysym(vk);
        if (ks == NoSymbol) return;
        KeyCode kc = XKeysymToKeycode(display_, ks);
        if (kc == 0) return;
        XTestFakeKeyEvent(display_, kc, press ? True : False, 0);
        XFlush(display_);
    }

    void mouse(const std::string& button, bool press) override {
        unsigned int b = 0;
        if      (button == "left")   b = 1;
        else if (button == "middle") b = 2;
        else if (button == "right")  b = 3;
        else if (button == "mouse4") b = 8;
        else if (button == "mouse5") b = 9;
        else return;
        XTestFakeButtonEvent(display_, b, press ? True : False, 0);
        XFlush(display_);
    }

    Display* raw_display() { return display_; }

private:
    explicit X11Backend(Display* d) : display_(d) {}
    Display* display_;
};

// =====================================================================================
// uinput backend (Wayland-native / X11-without-DISPLAY)
// =====================================================================================
class UInputBackend final : public IInputBackend {
public:
    static std::unique_ptr<UInputBackend> try_open() {
        int fd = ::open("/dev/uinput", O_WRONLY | O_NONBLOCK);
        if (fd < 0) {
            const int saved_errno = errno;
            if (saved_errno == EACCES) {
                std::cerr << "[castmate-input] Cannot open /dev/uinput (permission denied). "
                             "To enable Wayland-native input simulation, either install the "
                             "CastMate .deb (which ships a udev rule) or run:\n"
                             "  echo 'KERNEL==\"uinput\", MODE=\"0660\", GROUP=\"input\"' "
                             "| sudo tee /etc/udev/rules.d/99-castmate-uinput.rules\n"
                             "  sudo udevadm control --reload && sudo udevadm trigger\n"
                             "  sudo usermod -aG input $USER  (then log out and back in)"
                          << std::endl;
            } else if (saved_errno == ENOENT) {
                std::cerr << "[castmate-input] /dev/uinput is missing — the uinput kernel "
                             "module isn't available. Try: sudo modprobe uinput" << std::endl;
            }
            return nullptr;
        }

        // Tell the kernel which event types and codes this virtual device emits.
        // We never read its state back, only write, so no EV_REL/EV_ABS axes here.
        ::ioctl(fd, UI_SET_EVBIT, EV_KEY);
        ::ioctl(fd, UI_SET_EVBIT, EV_SYN);

        // Enable every Linux KEY_* code we know how to map from a Windows VK. Done
        // up front so the kernel allocates the keymap once at create-time.
        for (uint32_t vk = 0; vk <= 0xFF; ++vk) {
            uint32_t code = mapVkToLinuxKey(vk);
            if (code != 0) ::ioctl(fd, UI_SET_KEYBIT, code);
        }
        for (int btn : {BTN_LEFT, BTN_RIGHT, BTN_MIDDLE, BTN_SIDE, BTN_EXTRA}) {
            ::ioctl(fd, UI_SET_KEYBIT, btn);
        }

        struct uinput_setup usetup;
        std::memset(&usetup, 0, sizeof(usetup));
        usetup.id.bustype = BUS_VIRTUAL;
        usetup.id.vendor = 0x1234;
        usetup.id.product = 0xCA51;  // "CASt" + Mate
        std::strncpy(usetup.name, "CastMate Virtual Input", UINPUT_MAX_NAME_SIZE - 1);

        if (::ioctl(fd, UI_DEV_SETUP, &usetup) < 0 ||
            ::ioctl(fd, UI_DEV_CREATE) < 0) {
            std::cerr << "[castmate-input] uinput device setup failed." << std::endl;
            ::close(fd);
            return nullptr;
        }

        return std::unique_ptr<UInputBackend>(new UInputBackend(fd));
    }

    ~UInputBackend() override {
        if (fd_ >= 0) {
            ::ioctl(fd_, UI_DEV_DESTROY);
            ::close(fd_);
        }
    }

    const char* name() const override { return "uinput"; }

    void key(uint32_t vk, bool press) override {
        uint32_t code = mapVkToLinuxKey(vk);
        if (code == 0) return;
        write_event(EV_KEY, code, press ? 1 : 0);
        write_event(EV_SYN, SYN_REPORT, 0);
    }

    void mouse(const std::string& button, bool press) override {
        int code = 0;
        if      (button == "left")   code = BTN_LEFT;
        else if (button == "middle") code = BTN_MIDDLE;
        else if (button == "right")  code = BTN_RIGHT;
        else if (button == "mouse4") code = BTN_SIDE;
        else if (button == "mouse5") code = BTN_EXTRA;
        else return;
        write_event(EV_KEY, code, press ? 1 : 0);
        write_event(EV_SYN, SYN_REPORT, 0);
    }

private:
    explicit UInputBackend(int fd) : fd_(fd) {}

    void write_event(uint16_t type, uint16_t code, int32_t value) {
        struct input_event ev;
        std::memset(&ev, 0, sizeof(ev));
        ev.type = type;
        ev.code = code;
        ev.value = value;
        // Best-effort: a partial write or transient EAGAIN is silently dropped — losing
        // one event in 10000 is better than blocking the JS thread on a stuck pipe.
        (void)::write(fd_, &ev, sizeof(ev));
    }

    int fd_;
};

// =====================================================================================
// input_interface — exposes the JS class, dispatches to whichever backend opened
// =====================================================================================
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

        std::string requested = "auto";
        if (info.Length() > 1 && info[1].IsObject()) {
            Napi::Object opts = info[1].As<Napi::Object>();
            if (opts.Has("backend") && opts.Get("backend").IsString()) {
                requested = opts.Get("backend").As<Napi::String>().Utf8Value();
            }
        }

        const bool try_x11    = (requested == "auto" || requested == "x11");
        const bool try_uinput = (requested == "auto" || requested == "uinput");

        if (try_x11) {
            if (auto x11 = X11Backend::try_open()) {
                x11_raw_display_ = x11->raw_display();
                backend_ = std::move(x11);
            }
        }
        if (!backend_ && try_uinput) {
            if (auto ui = UInputBackend::try_open()) {
                backend_ = std::move(ui);
            }
        }
        if (!backend_) {
            if (requested == "x11") {
                std::cerr << "[castmate-input] Input backend forced to X11 but no display "
                             "was reachable — input simulation will be a no-op." << std::endl;
            } else if (requested == "uinput") {
                std::cerr << "[castmate-input] Input backend forced to uinput but "
                             "/dev/uinput is not accessible — input simulation will be a no-op."
                          << std::endl;
            } else {
                std::cerr << "[castmate-input] No X11 display and no /dev/uinput access — "
                             "input simulation is a no-op on this host." << std::endl;
            }
        }

        if (info.Length() > 0 && info[0].IsFunction()) {
            emit_tsfn_ = Napi::ThreadSafeFunction::New(
                info.Env(), info[0].As<Napi::Function>(), "InputInterfaceEmit",
                0, 1, this);
        }
    }

    void Finalize(Napi::Env /*env*/) override {
        stop_polling_locked();
        backend_.reset();
        x11_raw_display_ = nullptr;
        if (emit_tsfn_) {
            emit_tsfn_.Release();
            emit_tsfn_ = nullptr;
        }
    }

    Napi::Value simulate_key_down(const Napi::CallbackInfo& info) {
        if (backend_) backend_->key(info[0].As<Napi::Number>().Uint32Value(), true);
        return info.Env().Undefined();
    }
    Napi::Value simulate_key_up(const Napi::CallbackInfo& info) {
        if (backend_) backend_->key(info[0].As<Napi::Number>().Uint32Value(), false);
        return info.Env().Undefined();
    }
    Napi::Value simulate_mouse_down(const Napi::CallbackInfo& info) {
        if (backend_) backend_->mouse(info[0].As<Napi::String>().Utf8Value(), true);
        return info.Env().Undefined();
    }
    Napi::Value simulate_mouse_up(const Napi::CallbackInfo& info) {
        if (backend_) backend_->mouse(info[0].As<Napi::String>().Utf8Value(), false);
        return info.Env().Undefined();
    }

    Napi::Value is_key_down(const Napi::CallbackInfo& info) {
        uint32_t vk = info[0].As<Napi::Number>().Uint32Value();
        if (vk > 255) return Napi::Boolean::New(info.Env(), false);
        return Napi::Boolean::New(info.Env(), key_states_[vk]);
    }

    Napi::Value start_events(const Napi::CallbackInfo& info) {
        std::lock_guard<std::mutex> lk(poll_mutex_);
        if (poll_running_.load()) return info.Env().Undefined();
        if (!x11_raw_display_) return info.Env().Undefined();  // capture is X11-only
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
    void run_polling_loop() {
        Display* poll_display = XOpenDisplay(nullptr);
        if (!poll_display) {
            poll_running_.store(false);
            return;
        }

        char prev_keymap[32] = {0};
        char cur_keymap[32];

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

                // Two-tier lookup so global hotkey capture works on every keyboard
                // layout, not just US:
                //   1) Try mapping the active layout's keysym at this keycode to a
                //      Windows VK. Hits for letters/digits/F-keys + US-named
                //      punctuation — anything CastMate's hotkey UI already knows
                //      about. On AZERTY/QWERTZ/Dvorak/etc. the keysyms for the
                //      letter keys still resolve here, so most hotkeys "just work".
                //   2) If the keysym is unknown (typical for layout-specific
                //      diacritics like `é`/`à`/`ü`/`ñ` or non-Latin scripts),
                //      fall back to the physical position via the kernel scancode
                //      (`kc - min_kc` on Xorg ≈ `keycode - 8`). That way a key
                //      *always* reports SOME VK, and the user can bind it.
                KeySym ks = keysyms_table[(kc - min_kc) * keysyms_per_kc];
                uint32_t vk = mapKeysymToVk(ks);
                if (vk == 0) {
                    // X11 keycode = kernel scancode + 8 on Linux/evdev. Use that
                    // explicit offset rather than (kc - min_kc), which is just an
                    // index into our keysyms_table array.
                    vk = mapLinuxKeyToVk(static_cast<uint32_t>(kc - 8));
                }
                if (vk == 0) continue;

                if (vk < 256) key_states_[vk] = now;
                emit_key_event(vk, now);
            }

            std::memcpy(prev_keymap, cur_keymap, sizeof(prev_keymap));
            std::this_thread::sleep_for(std::chrono::milliseconds(33));
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

    void stop_polling_locked() {
        if (!poll_running_.load()) return;
        poll_running_.store(false);
        if (poll_thread_.joinable()) poll_thread_.join();
    }

    std::unique_ptr<IInputBackend> backend_;
    // Non-owning pointer to the X11 backend's display, set only when the X11 backend is
    // active. Used to gate `startEvents()` — uinput can emit but cannot capture, so
    // event polling is X11-only.
    Display* x11_raw_display_ = nullptr;

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
