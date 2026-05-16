// Linux stub for castmate-plugin-sound-native.
// Exposes the same JS surface as the Windows implementation (see ../audio-interface.* and
// ../tts-interface.*) so plugins/sound/main can import without changes. Methods return empty
// data / no-ops; a real Linux backend (PulseAudio + speech-dispatcher) lands in milestone M7.

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
        : Napi::ObjectWrap<audio_device_interface>(info)
    {
    }

    Napi::Value get_devices(const Napi::CallbackInfo& info)
    {
        return Napi::Array::New(info.Env());
    }

    Napi::Value get_default_output(const Napi::CallbackInfo& info)
    {
        return info.Env().Undefined();
    }

    Napi::Value get_default_input(const Napi::CallbackInfo& info)
    {
        return info.Env().Undefined();
    }
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
        : Napi::ObjectWrap<os_tts_interface>(info)
    {
    }

    Napi::Value get_voices(const Napi::CallbackInfo& info)
    {
        return Napi::Array::New(info.Env());
    }

    Napi::Value speak_to_file(const Napi::CallbackInfo& info)
    {
        return Napi::Boolean::New(info.Env(), false);
    }
};

static Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    audio_device_interface::init(env, exports);
    os_tts_interface::init(env, exports);
    return exports;
}

NODE_API_MODULE(castmate_plugin_sound_native, Init)
