import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	ResourceStorage,
	Resource,
	defineState,
	FileResource,
	definePluginResource,
	defineSetting,
	defineResourceSetting,
	defineReactiveState,
	usePluginLogger,
} from "castmate-core"
import { t, registerPluginTranslations, generatedTranslationsFromDirectory } from "castmate-translation"
import { Color, Toggle } from "castmate-schema"
import { OBSConnection, setupConnections, onOBSWebsocketEvent } from "./connection"
import { setupSources } from "./sources"
import { setupScenes } from "./scenes"
import { setupMedia } from "./media"
import { setupToggles } from "./toggles"
import { setupTransforms } from "./transform"

import { attemptQRReading, setupAutoConnect } from "./auto-connect"
import { setupAudio } from "./audio"
import { fileURLToPath } from "url"
import path from "path"

registerPluginTranslations("obs", generatedTranslationsFromDirectory(path.resolve("../../plugins/obs/lang")))

export default definePlugin(
	{
		id: "obs",
		name: "OBS",
		description: "Provides OBS Control over OBS Websocket 5",
		color: "#256eff",
		icon: "obsi obsi-obs",
	},
	() => {
		const logger = usePluginLogger()
		logger.log("Starting OBS!")

		setupConnections()
		setupAutoConnect()

		const obsDefault = defineSetting("obsDefault", {
			type: OBSConnection,
			name: t("plugins.obs.settings.default_connection.name"),
			required: true,
		})

		defineResourceSetting(OBSConnection, t("plugins.obs.settings.obs_connections"))

		defineReactiveState(
			"scene",
			{
				type: String,
				name: t("plugins.obs.states.scene.name"),
				required: true,
				async enum() {
					return await obsDefault.value.getSceneNames()
				},
			},
			() => {
				return obsDefault.value?.state?.scene ?? ""
			}
		)

		defineReactiveState(
			"streaming",
			{
				type: Boolean,
				name: t("plugins.obs.states.streaming.name"),
				required: true,
			},
			() => {
				return obsDefault.value?.state?.streaming ?? false
			}
		)

		defineReactiveState(
			"recording",
			{
				type: Boolean,
				name: t("plugins.obs.states.recording.name"),
				required: true,
			},
			() => {
				return obsDefault.value?.state?.recording ?? false
			}
		)

		defineReactiveState(
			"replayBuffering",
			{
				type: Boolean,
				name: t("plugins.obs.states.replay_buffering.name"),
				required: true,
			},
			() => {
				return obsDefault.value?.state?.replayBuffering ?? false
			}
		)

		defineReactiveState(
			"virtualCamming",
			{
				type: Boolean,
				name: t("plugins.obs.states.virtual_cam_active.name"),
				required: true,
			},
			() => {
				return obsDefault.value?.state?.virtualCamming ?? false
			}
		)

		defineReactiveState(
			"connected",
			{
				type: Boolean,
				name: "Connected",
				required: true,
			},
			() => {
				return obsDefault.value?.state?.connected ?? false
			}
		)

		setupScenes(obsDefault)
		setupSources(obsDefault)
		setupMedia(obsDefault)
		setupAudio(obsDefault)
		setupToggles(obsDefault)
		setupTransforms(obsDefault)

		defineAction({
			id: "hotkey",
			name: "Hotkey",
			icon: "mdi mdi-keyboard-variant",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: "OBS Connection",
						required: true,
						default: () => obsDefault.value,
					},
					hotkey: {
						type: String,
						name: "Hotkey",
						required: true,
						async enum(context: { obs: OBSConnection }) {
							if (!context.obs) return []

							const result = await context.obs.connection.call("GetHotkeyList")
							return result.hotkeys
						},
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await config.obs?.connection?.call("TriggerHotkeyByName", { hotkeyName: config.hotkey })
			},
		})
	}
)

export { OBSConnection, onOBSWebsocketEvent, attemptQRReading }
