import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	defineSetting,
	usePluginLogger,
} from "castmate-core"
import { VoiceModClient } from "./client"
import { registerPluginTranslations, generatedTranslationsFromFiles, t } from "castmate-translation"

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

registerPluginTranslations("voicemod", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "voicemod",
		name: t("plugins.voicemod.plugin.name"),
		description: t("plugins.voicemod.plugin.description"),
		icon: "mdi mdi-star",
		color: "#3F918D",
	},
	() => {
		const logger = usePluginLogger()
		let voiceMod: VoiceModClient = new VoiceModClient()

		const voiceModHost = defineSetting("host", {
			type: String,
			name: t("plugins.voicemod.settings.host"),
			default: "127.0.0.1",
			required: true,
		})

		async function tryConnect() {
			try {
				await voiceMod.connect(voiceModHost.value)
			} catch (err) { }
		}

		function retryConnection() {
			setTimeout(async () => {
				await tryConnect()
			}, 30 * 1000)
		}

		onLoad((plugin) => {
			voiceMod.onClose = () => retryConnection()
			tryConnect()
		})

		defineAction({
			id: "selectVoice",
			name: t("plugins.voicemod.actions.selectVoice.name"),
			description: t("plugins.voicemod.actions.selectVoice.description"),
			icon: "mdi mdi-account-voice",
			config: {
				type: Object,
				properties: {
					voice: {
						type: String,
						name: t("plugins.voicemod.common.voice"),
						required: true,
						default: "nofx",
						async enum() {
							//logger.log("Voice Enum Fetch")
							const voices = await voiceMod.getVoices()

							const enumVoices = voices.filter((v) => v.isEnabled)

							//logger.log(enumVoices)

							return enumVoices.map((v) => ({
								value: v.id,
								name: v.friendlyName,
							}))
						},
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await voiceMod.selectVoice(config.voice)
			},
		})
	}
)
