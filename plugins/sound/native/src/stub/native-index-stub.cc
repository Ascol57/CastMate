// Fallback stub for castmate-plugin-sound-native on platforms without a real backend
// (currently macOS — Windows has its own sources and Linux has src/linux/).
//
// Exposes the same JS surface as the other backends so the rest of the codebase can
// import it without conditionals; every method is a no-op. A real macOS backend
// (CoreAudio device enumeration + NSSpeechSynthesizer TTS) can replace this file
// when that work lands.

#include <napi.h>

class audio_device_interface : public Napi::ObjectWrap<audio_device_interface>
{
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function constructor = DefineClass(env, "NativeAudioDeviceInterface", {
            InstanceMethod("getDevices",       &audio_device_interface::get_devices),
            InstanceMethod("getDefaultOutput", &audio_device_interface::get_default_output),
            InstanceMethod("getDefaultInput",  &audio_device_interface::get_default_input),
        });
        exports.Set("NativeAudioDeviceInterface", constructor);
        return exports;
    }

    audio_device_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<audio_device_interface>(info) {}

    Napi::Value get_devices(const Napi::CallbackInfo& info)        { return Napi::Array::New(info.Env()); }
    Napi::Value get_default_output(const Napi::CallbackInfo& info) { return info.Env().Undefined(); }
    Napi::Value get_default_input(const Napi::CallbackInfo& info)  { return info.Env().Undefined(); }
};

class os_tts_interface : public Napi::ObjectWrap<os_tts_interface>
{
public:
    static Napi::Object init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function constructor = DefineClass(env, "OsTTSInterface", {
            InstanceMethod("getVoices",   &os_tts_interface::get_voices),
            InstanceMethod("speakToFile", &os_tts_interface::speak_to_file),
        });
        exports.Set("OsTTSInterface", constructor);
        return exports;
    }

    os_tts_interface(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<os_tts_interface>(info) {}

    Napi::Value get_voices(const Napi::CallbackInfo& info)   { return Napi::Array::New(info.Env()); }
    Napi::Value speak_to_file(const Napi::CallbackInfo& info){ return Napi::Boolean::New(info.Env(), false); }
};

static Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    audio_device_interface::init(env, exports);
    os_tts_interface::init(env, exports);
    return exports;
}

NODE_API_MODULE(castmate_plugin_sound_native, Init)
