import {
	defineAction,
	onLoad,
	definePlugin,
	onUILoad,
	defineSetting,
	definePluginResource,
	probeMedia,
} from "castmate-core"
import { MediaManager } from "castmate-core"
import { Duration, MediaFile } from "castmate-schema"
import { RendererSoundPlayer } from "./renderer-sound-player"
import { AudioDeviceInterface } from "castmate-plugin-sound-native"
import { SoundOutput, setupOutput } from "./output"
import { TTSVoice, setupTTS } from "./tts"
import { setupSplitters } from "./splitter"
import { generatedTranslationsFromFiles, registerPluginTranslations, t } from "castmate-translation"

const translationFiles = {
	en: (import.meta.glob('../../lang/en.yml', {
		query: '?raw',
		eager: true
	})["../../lang/en.yml"] as any)?.default,
	fr: (import.meta.glob('../../lang/fr.yml', {
		query: '?raw',
		eager: true
	})["../../lang/fr.yml"] as any)?.default
}

registerPluginTranslations("sound", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "sound",
		name: t("plugins.sound.plugin.name"),
		color: "#62894F",
		description: t("plugins.sound.plugin.description"),
		icon: "mdi mdi-volume-high",
	},
	() => {
		const globalVolume = defineSetting("globalVolume", {
			type: Number,
			name: t("plugins.sound.settings.globalVolume"),
			slider: true,
			min: 0,
			max: 100,
			required: true,
			default: 100,
		})

		setupOutput()
		setupSplitters()
		setupTTS()

		defineAction({
			id: "sound",
			name: t("plugins.sound.actions.sound.name"),
			icon: "mdi mdi-volume-high",
			description: t("plugins.sound.actions.sound.description"),
			duration: {
				propDependencies: ["sound"],
				async callback(config) {
					const media = MediaManager.getInstance().getMedia(config.sound)
					const duration = media?.duration ?? 1
					return {
						indefinite: !media,
						dragType: "crop",
						leftSlider: {
							min: 0,
							max: duration,
							sliderProp: "startTime",
						},
						rightSlider: {
							min: 0,
							max: duration,
							sliderProp: "endTime",
						},
						duration: duration,
					}
				},
			},
			config: {
				type: Object,
				properties: {
					output: { type: SoundOutput, name: t("plugins.sound.common.output"), default: () => defaultOutput.value, required: true },
					sound: { type: MediaFile, name: t("plugins.sound.common.sound"), required: true, default: "", sound: true },
					volume: {
						type: Number,
						name: t("plugins.sound.common.volume"),
						required: true,
						default: 100,
						slider: true,
						min: 0,
						max: 100,
						step: 1,
					},
					startTime: { type: Duration, name: t("plugins.sound.common.startTimestamp"), required: true, default: 0 },
					endTime: { type: Duration, name: t("plugins.sound.common.endTimestamp"), required: true, default: 0 },
				},
			},
			async invoke(config, contextData, abortSignal) {
				const media = MediaManager.getInstance().getMedia(config.sound)
				if (!media) return
				const globalFactor = globalVolume.value / 100
				await config.output.playFile(
					media.file,
					config.startTime,
					config.endTime ?? media.duration ?? 0,
					config.volume * globalFactor,
					abortSignal
				)
			},
		})

		defineAction({
			id: "tts",
			name: t("plugins.sound.actions.tts.name"),
			description: t("plugins.sound.actions.tts.description"),
			icon: "mdi mdi-account-voice",
			config: {
				type: Object,
				properties: {
					output: { type: SoundOutput, name: t("plugins.sound.common.output"), default: () => defaultOutput.value, required: true },
					voice: { type: TTSVoice, name: t("plugins.sound.common.voice"), required: true, template: true },
					text: { type: String, name: t("plugins.sound.common.text"), required: true, template: true },
					volume: {
						type: Number,
						name: t("plugins.sound.common.volume"),
						required: true,
						default: 100,
						slider: true,
						min: 0,
						max: 100,
						step: 1,
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				const voiceFile = await config.voice?.generate(config.text)
				if (!voiceFile) return
				const globalFactor = globalVolume.value / 100

				const probeInfo = await probeMedia(voiceFile)

				let duration = probeInfo.format.duration as number | string | undefined

				let finalDuration = undefined
				if (duration && duration != "N/A") {
					finalDuration = Number(duration)
				}

				await config.output.playFile(
					voiceFile,
					0,
					finalDuration ?? Number.POSITIVE_INFINITY,
					config.volume * globalFactor,
					abortSignal
				)
			},
		})

		const defaultOutput = defineSetting("defaultOutput", {
			type: SoundOutput,
			name: t("plugins.sound.settings.defaultOutput"),
			required: true,
			default: () => SoundOutput.storage.getById("system.default"),
		})
	}
)

export { SoundOutput }
