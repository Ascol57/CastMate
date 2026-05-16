{
    "targets": [
        {
            "target_name": "castmate-plugin-sound-native",
            "cflags!": [ "-fno-exceptions" ],
            "cflags_cc!": [ "-fno-exceptions" ],
            "include_dirs": [
                "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS=1" ],
            "conditions": [
                ["OS=='win'", {
                    "sources": [ "src/native-index.cc", "src/util.cc", "src/audio-interface.cc", "src/tts-interface.cc" ]
                }],
                ["OS=='linux'", {
                    "sources": [ "src/linux/native-index-linux.cc" ],
                    "cflags_cc": [ "-std=c++17", "-pthread" ],
                    "libraries": [ "-lpthread" ]
                }],
                ["OS=='mac'", {
                    "sources": [ "src/stub/native-index-stub.cc" ]
                }]
            ]
        }
    ]
}
