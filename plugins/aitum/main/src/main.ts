import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	useSetting,
	getSettingValue,
	defineTransformTrigger,
} from "castmate-core"
import { OBSConnection, onOBSWebsocketEvent } from "castmate-plugin-obs-main"
import { Command, getCommandDataSchema, matchAndParseCommand, Toggle } from "castmate-schema"
import { t, registerPluginTranslations, generatedTranslationsFromFiles } from "castmate-translation"
import path from "path"

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

registerPluginTranslations("aitum", generatedTranslationsFromFiles(translationFiles))

const aitumVerticalVendor = "aitum-vertical-canvas"

async function getVerticalScenes(obsConnection: OBSConnection) {
	if (!obsConnection.state.connected) return []

	try {
		const result = await obsConnection.connection.call("CallVendorRequest", {
			vendorName: aitumVerticalVendor,
			requestType: "get_scenes",
		})

		const scenes = (result.responseData?.scenes ?? []) as { name: string }[]
		return scenes.map((s) => s.name)
	} catch (err) {
		return []
	}
}

async function getVerticalStatus(obsConnection: OBSConnection) {
	if (!obsConnection.state.connected) return undefined

	try {
		const result = await obsConnection.connection.call("CallVendorRequest", {
			vendorName: aitumVerticalVendor,
			requestType: "status",
		})

		return result.responseData as {
			streaming: boolean
			recording: boolean
			backtrack: boolean
			virtual_camera: boolean
			success: boolean
		}
	} catch (err) {
		return undefined
	}
}

export default definePlugin(
	{
		id: "aitum",
		name: t("plugins.aitum.plugin.name"),
		description: t("plugins.aitum.plugin.description"),
		color: "#256eff",
		icon: "atmi atmi-aitum",
	},
	() => {
		defineAction({
			id: "verticalScene",
			name: t("plugins.aitum.actions.verticalScene.name"),
			icon: "mdi mdi-swap-horizontal-bold",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.verticalScene.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					scene: {
						type: String,
						name: t("plugins.aitum.actions.verticalScene.config.scene"),
						required: true,
						//template: true,
						async enum(context: { obs: OBSConnection }) {
							return (await getVerticalScenes(context.obs)) ?? []
						},
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await config.obs.connection.call("CallVendorRequest", {
					vendorName: aitumVerticalVendor,
					requestType: "switch_scene",
					requestData: {
						scene: config.scene,
					},
				})
			},
		})

		defineAction({
			id: "verticalStreamStartStop",
			name: t("plugins.aitum.actions.verticalStreamStartStop.name"),
			icon: "mdi mdi-broadcast",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.verticalStreamStartStop.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					streaming: {
						type: Toggle,
						name: t("plugins.aitum.actions.verticalStreamStartStop.config.streaming"),
						required: true,
						default: true,
						template: true,
						trueIcon: "mdi mdi-broadcast",
						falseIcon: "mdi mdi-broadcast-off",
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				if (config.streaming == "toggle") {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "toggle_streaming",
					})
				} else if (config.streaming === true) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "start_streaming",
					})
				} else if (config.streaming === false) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "stop_streaming",
					})
				}
			},
		})

		defineAction({
			id: "verticalRecordingStartStop",
			name: t("plugins.aitum.actions.verticalRecordingStartStop.name"),
			icon: "mdi mdi-record",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.verticalRecordingStartStop.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					streaming: {
						type: Toggle,
						name: t("plugins.aitum.actions.verticalRecordingStartStop.config.streaming"),
						required: true,
						default: true,
						template: true,
						trueIcon: "mdi mdi-record",
						falseIcon: "mdi mdi-stop",
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				if (config.streaming == "toggle") {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "toggle_recording",
					})
				} else if (config.streaming === true) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "start_recording",
					})
				} else if (config.streaming === false) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "stop_recording",
					})
				}
			},
		})

		defineAction({
			id: "verticalBacktrackStartStop",
			name: t("plugins.aitum.actions.verticalBacktrackStartStop.name"),
			icon: "atmi atmi-aitum",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.verticalBacktrackStartStop.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					streaming: {
						type: Toggle,
						name: t("plugins.aitum.actions.verticalBacktrackStartStop.config.streaming"),
						required: true,
						default: true,
						template: true,
						trueIcon: "mdi mdi-record",
						falseIcon: "mdi mdi-stop",
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				if (config.streaming == "toggle") {
					const status = await getVerticalStatus(config.obs)

					const requestType = status?.backtrack ? "stop_backtrack" : "start_backtrack"

					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType,
					})
				} else if (config.streaming === true) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "start_backtrack",
					})
				} else if (config.streaming === false) {
					await config.obs.connection.call("CallVendorRequest", {
						vendorName: aitumVerticalVendor,
						requestType: "stop_backtrack",
					})
				}
			},
		})

		defineAction({
			id: "saveBacktrack",
			name: t("plugins.aitum.actions.saveBacktrack.name"),
			description: t("plugins.aitum.actions.saveBacktrack.description"),
			icon: "mdi mdi-content-save",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.saveBacktrack.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await config.obs.connection.call("CallVendorRequest", {
					vendorName: aitumVerticalVendor,
					requestType: "save_backtrack",
				})
			},
		})

		defineAction({
			id: "verticalChapterMarker",
			name: t("plugins.aitum.actions.verticalChapterMarker.name"),
			description: t("plugins.aitum.actions.verticalChapterMarker.description"),
			icon: "mdi mdi-map-marker",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.aitum.actions.verticalChapterMarker.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					chapterName: {
						type: String,
						name: t("plugins.aitum.actions.verticalChapterMarker.config.chapterName"),
						template: true,
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await config.obs.connection.call("CallVendorRequest", {
					vendorName: aitumVerticalVendor,
					requestType: "add_chapter",
					requestData: {
						chapter_name: config.chapterName ?? "",
					},
				})
			},
		})
	}
)
