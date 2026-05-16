// Linux stub for castmate-plugin-input-native.
// Exposes the same JS surface as the Windows implementation (see ../native-index.cc and
// ../input-interface.cc) so plugins/input/main can import without changes. Methods are
// no-ops here; a real Linux backend (XTest / libevdev / uinput) lands in milestone M6.

#include <napi.h>
#include <cstring>

class input_interface : public Napi::ObjectWrap<input_interface>
{
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function constructor = DefineClass(env, "NativeInputInterface", {
            InstanceMethod("simulateKeyDown", &input_interface::simulate_key_down),
            InstanceMethod("simulateKeyUp", &input_interface::simulate_key_up),
            InstanceMethod("simulateMouseDown", &input_interface::simulate_mouse_down),
            InstanceMethod("simulateMouseUp", &input_interface::simulate_mouse_up),
            InstanceMethod("startEvents", &input_interface::start_events),
            InstanceMethod("stopEvents", &input_interface::stop_events),
            InstanceMethod("isKeyDown", &input_interface::is_key_down),
        });

        exports.Set("NativeInputInterface", constructor);
        return exports;
    }

    input_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<input_interface>(info)
    {
        memset(key_states, 0, sizeof(key_states));
    }

    Napi::Value simulate_key_down(const Napi::CallbackInfo& info) { return info.Env().Undefined(); }
    Napi::Value simulate_key_up(const Napi::CallbackInfo& info)   { return info.Env().Undefined(); }
    Napi::Value simulate_mouse_down(const Napi::CallbackInfo& info) { return info.Env().Undefined(); }
    Napi::Value simulate_mouse_up(const Napi::CallbackInfo& info)   { return info.Env().Undefined(); }
    Napi::Value start_events(const Napi::CallbackInfo& info)        { return info.Env().Undefined(); }
    Napi::Value stop_events(const Napi::CallbackInfo& info)         { return info.Env().Undefined(); }

    Napi::Value is_key_down(const Napi::CallbackInfo& info)
    {
        uint32_t vkcode = info[0].As<Napi::Number>().Uint32Value();
        if (vkcode > 255) return Napi::Boolean::New(info.Env(), false);
        return Napi::Boolean::New(info.Env(), key_states[vkcode]);
    }

private:
    bool key_states[256];
};

static Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    input_interface::init(env, exports);
    return exports;
}

NODE_API_MODULE(castmate_plugin_input_native, Init)
