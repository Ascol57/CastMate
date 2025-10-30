import { MediaManager, ReactiveRef, WebService, defineAction, ensureDirectory } from "castmate-core"
import { t } from "castmate-translation"
import { OBSConnection } from "./connection"
import { Directory, MediaFile, Toggle, Duration } from "castmate-schema"
import path from "path"

export function setupSources(obsDefault: ReactiveRef<OBSConnection>) {
	defineAction({
		id: "source",
		name: t("plugins.obs.actions.source_visibility.name"),
		description: t("plugins.obs.actions.source_visibility.description"),
		icon: "mdi mdi-eye",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				scene: {
					type: String,
					required: true,
					name: t("plugins.obs.common.scene"),
					template: true,
					async enum(context: { obs: OBSConnection }) {
						return (await context?.obs?.getSceneAndGroupNames()) ?? []
					},
				},
				source: {
					type: Number,
					name: t("plugins.obs.common.source"),
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; scene: string }) {
						if (!context.obs) return []

						return await context.obs.getSceneSources(context.scene)
					},
				},
				enabled: {
					type: Toggle,
					name: t("plugins.obs.common.sourceVisibility"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-eye-outline",
					falseIcon: "mdi mdi-eye-off-outline",
				},
			},
		},
		result: {
			type: Object,
			properties: {
				sourceEnabled: { type: Boolean, name: t("plugins.obs.results.source_enabled"), required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const sceneName = config.scene
			const sceneItemId = config.source

			if (!config.obs) return { sourceEnabled: false }

			let enabled = config.enabled
			if (enabled === "toggle") {
				const { sceneItemEnabled } = await config.obs.connection.call("GetSceneItemEnabled", {
					sceneName,
					sceneItemId,
				})
				enabled = !sceneItemEnabled
			}

			await config.obs.connection.call("SetSceneItemEnabled", {
				sceneName,
				sceneItemId,
				sceneItemEnabled: enabled,
			})

			return { sourceEnabled: enabled }
		},
	})

	defineAction({
		id: "filter",
		name: t("plugins.obs.actions.filter_visibility.name"),
		description: t("plugins.obs.actions.filter_visibility.description"),
		icon: "mdi mdi-eye",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					//template: true,
					name: t("plugins.obs.common.source"),
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const { inputs } = await obs.call("GetInputList")
						const { scenes } = await obs.call("GetSceneList")
						return [
							...inputs.map((i) => i.inputName as string),
							...scenes.map((s) => s.sceneName as string),
						]
					},
				},
				filterName: {
					type: String,
					name: t("plugins.obs.common.filterVisibility"),
					//template: true,
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; sourceName: string }) {
						const obs = context.obs?.connection
						if (!obs) return []

						const { filters } = await obs.call("GetSourceFilterList", {
							sourceName: context.sourceName,
						})

						return filters.map((f) => f.filterName as string)
					},
				},
				filterEnabled: {
					type: Toggle,
					name: "Filter Enabled",
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-eye-outline",
					falseIcon: "mdi mdi-eye-off-outline",
				},
			},
		},
		result: {
			type: Object,
			properties: {
				filterEnabled: { type: Boolean, name: "Filter Enabled", required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const sourceName = config.sourceName
			const filterName = config.filterName

			if (!config.obs) return { filterEnabled: false }

			let enabled = config.filterEnabled
			if (enabled == "toggle") {
				const { filterEnabled } = await config.obs.connection.call("GetSourceFilter", {
					sourceName,
					filterName,
				})
				enabled = !filterEnabled
			}

			await config.obs.connection.call("SetSourceFilterEnabled", {
				sourceName,
				filterName,
				filterEnabled: enabled,
			})

			return {
				filterEnabled: enabled,
			}
		},
	})

	defineAction({
		id: "smooth_filter_settings",
		name: t("plugins.obs.actions.smooth_filter_settings.name"),
		description: t("plugins.obs.actions.smooth_filter_settings.description"),
		icon: "mdi mdi-eye",
		duration: {
			dragType: "length",
			rightSlider: {
				sliderProp: "duration",
			},
		},
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					//template: true,
					name: t("plugins.obs.common.source"),
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const { inputs } = await obs.call("GetInputList")
						const { scenes } = await obs.call("GetSceneList")
						return [
							...inputs.map((i) => i.inputName as string),
							...scenes.map((s) => s.sceneName as string),
						]
					},
				},
				filterName: {
					type: String,
					name: t("plugins.obs.common.filterVisibility"),
					//template: true,
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; sourceName: string }) {
						const obs = context.obs?.connection
						if (!obs) return []

						const { filters } = await obs.call("GetSourceFilterList", {
							sourceName: context.sourceName,
						})

						return filters.map((f) => f.filterName as string)
					},
				},
				settingsName: {
					type: String,
					name: t("plugins.obs.common.filterSettings"),
					//template: true,
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; sourceName: string; filterName: string }) {
						const obs = context.obs?.connection
						if (!obs) return []

						// Use the typed request that's defined in OBSRequestTypes
						const { filters } = await obs.call("GetSourceFilterList", {
							sourceName: context.sourceName,
						})

						for (const filter of filters) {
							// compare against the selected filterName, not sourceNamec
							if (filter.filterName === context.filterName) {
								const settings = filter.filterSettings as Record<string, any> | undefined
								// If settings is missing or not an object, return an empty array so the enum
								// resolver doesn't throw (Object.keys on undefined).
								if (!settings || typeof settings !== "object") return []
								// Return a map-like array of objects so UI can use id/name pairs
								return Object.keys(settings)
							}
						}

						// Always return an array to satisfy the expected enum type
						return []
					},
				},
				settings: {
					type: Number,
					name: t("plugins.obs.common.settingContent"),
					template: true,
					required: true,
					default: 0,
				},
				duration: { type: Duration, name: t("plugins.time.common.duration"), template: true, required: true, default: 1.0 },
				smooth_function: {
					type: String,
					name: t("plugins.obs.common.smoothFunction"),
					required: true,
					async enum() {
						return ["linear", "easeIn", "easeOut", "easeInOut"]
					}
				}
			},
		},
		result: {
			type: Object,
			properties: {},
		},
		async invoke(config, contextData, abortSignal) {
			const sourceName = config.sourceName
			const filterName = config.filterName
			const settingsName = config.settingsName
			const settingsValue = config.settings
			const duration = config.duration
			const smoothFunction = config.smooth_function

			if (!config.obs) return {}

			// Get current filter settings
			const { filterSettings } = await config.obs.connection.call("GetSourceFilter", {
				sourceName,
				filterName,
			})

			const initialValue = (filterSettings as Record<string, any>)[settingsName]
			const startTime = Date.now()
			const endTime = startTime + duration * 1000

			while (true) {
				const now = Date.now()
				if (now >= endTime) {
					break
				}
				const t = (now - startTime) / (endTime - startTime)
				let smoothT = t
				switch (smoothFunction) {
					case "easeIn":
						smoothT = t * t
						break
					case "easeOut":
						smoothT = t * (2 - t)
						break
					case "easeInOut":
						smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
						break
				}
				const currentValue = initialValue + (settingsValue - initialValue) * smoothT
					; (filterSettings as Record<string, any>)[settingsName] = currentValue
				await config.obs.connection.call("SetSourceFilterSettings", {
					sourceName,
					filterName,
					filterSettings,
				})
				await new Promise((resolve) => setTimeout(resolve, 16)) // ~60fps
			}

			; (filterSettings as Record<string, any>)[settingsName] = settingsValue
			await config.obs.connection.call("SetSourceFilterSettings", {
				sourceName,
				filterName,
				filterSettings,
			})

			return {}
		},
	})

	defineAction({
		id: "filter_settings",
		name: t("plugins.obs.actions.set_filter_settings.name"),
		description: t("plugins.obs.actions.set_filter_settings.description"),
		icon: "mdi mdi-eye",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					//template: true,
					name: t("plugins.obs.common.source"),
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const { inputs } = await obs.call("GetInputList")
						const { scenes } = await obs.call("GetSceneList")
						return [
							...inputs.map((i) => i.inputName as string),
							...scenes.map((s) => s.sceneName as string),
						]
					},
				},
				filterName: {
					type: String,
					name: t("plugins.obs.common.filterVisibility"),
					//template: true,
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; sourceName: string }) {
						const obs = context.obs?.connection
						if (!obs) return []

						const { filters } = await obs.call("GetSourceFilterList", {
							sourceName: context.sourceName,
						})

						return filters.map((f) => f.filterName as string)
					},
				},
				settingsName: {
					type: String,
					name: t("plugins.obs.common.filterSettings"),
					//template: true,
					required: true,
					template: true,
					async enum(context: { obs: OBSConnection; sourceName: string; filterName: string }) {
						const obs = context.obs?.connection
						if (!obs) return []

						// Use the typed request that's defined in OBSRequestTypes
						const { filters } = await obs.call("GetSourceFilterList", {
							sourceName: context.sourceName,
						})

						for (const filter of filters) {
							// compare against the selected filterName, not sourceNamec
							if (filter.filterName === context.filterName) {
								const settings = filter.filterSettings as Record<string, any> | undefined
								// If settings is missing or not an object, return an empty array so the enum
								// resolver doesn't throw (Object.keys on undefined).
								if (!settings || typeof settings !== "object") return []
								// Return a map-like array of objects so UI can use id/name pairs
								return Object.keys(settings)
							}
						}

						// Always return an array to satisfy the expected enum type
						return []
					},
				},
				settings: {
					type: Number,
					name: t("plugins.obs.common.settingContent"),
					template: true,
					required: true,
					default: 0,
				}
			},
		},
		result: {
			type: Object,
			properties: {},
		},
		async invoke(config, contextData, abortSignal) {
			const sourceName = config.sourceName
			const filterName = config.filterName
			const settingsName = config.settingsName
			const settingsValue = config.settings

			if (!config.obs) return {}

			// Get current filter settings
			const { filterSettings } = await config.obs.connection.call("GetSourceFilter", {
				sourceName,
				filterName,
			})

				// Update the specific setting
				; (filterSettings as Record<string, any>)[settingsName] = settingsValue
			// Send the updated settings back to OBS
			await config.obs.connection.call("SetSourceFilterSettings", {
				sourceName,
				filterName,
				filterSettings,
			})

			return {}
		},
	})

	defineAction({
		id: "screenshot",
		name: t("plugins.obs.actions.screenshot.name"),
		description: t("plugins.obs.actions.screenshot.description"),
		icon: "mdi mdi-camera",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					name: t("plugins.obs.common.source"),
					template: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const { inputs } = await obs.call("GetInputList")
						const { scenes } = await obs.call("GetSceneList")
						return [
							...inputs.map((i) => i.inputName as string),
							...scenes.map((s) => s.sceneName as string),
						]
					},
				},
				width: {
					type: Number,
					name: t("plugins.obs.actions.screenshot.config.width"),
					template: true,
				},
				height: {
					type: Number,
					name: t("plugins.obs.actions.screenshot.config.height"),
					template: true,
				},
				directory: {
					type: Directory,
					name: t("plugins.obs.actions.screenshot.config.directory"),
					required: true,
				},
				filename: {
					type: String,
					name: t("plugins.obs.actions.screenshot.config.filename"),
					default: "screenshot-{{ Date.now() }}.png",
					template: true,
					required: true,
				},
			},
		},
		result: {
			type: Object,
			properties: {
				screenshot: { type: String, required: true, name: t("plugins.obs.actions.screenshot.result.screenshot") },
			},
		},
		async invoke(config, contextData, abortSignal) {
			let ext = path.extname(config.filename)
			const basename = path.basename(config.filename, ext)

			//if (ext == "") {
			ext = ".png"
			//}

			await ensureDirectory(config.directory)

			const filename = path.join(config.directory, `${basename}${ext}`)

			//TODO: Check for other formats? JPG?

			let sourceName = config.sourceName
			if (!sourceName) {
				//HACK: We want to screenshot the stream output if there's no supplied source. However,
				// OBS Websocket doesn't have this feature. Instead we screenshot the active scene.
				// This can miss in progress transitions and downstream keyer elements.
				sourceName = config.obs.state.scene
			}

			const resp = await config.obs.connection.call("SaveSourceScreenshot", {
				sourceName,
				imageFormat: "png",
				imageFilePath: filename,
			})

			return {
				screenshot: filename,
			}
		},
	})

	defineAction({
		id: "text",
		name: t("plugins.obs.actions.text.name"),
		description: t("plugins.obs.actions.text.description"),
		icon: "mdi mdi-form-textbox",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					name: t("plugins.obs.common.source"),
					required: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const textInputs = await context.obs.getInputs(["text_gdiplus_v2", "text_gdiplus_v3"])
						return textInputs
					},
				},
				text: {
					type: String,
					name: t("plugins.obs.common.text"),
					template: true,
					required: true,
					multiLine: true,
					default: "",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			await config.obs.connection.call("SetInputSettings", {
				inputName: config.sourceName,
				inputSettings: {
					text: config.text,
				},
			})
		},
	})

	defineAction({
		id: "refreshBrowser",
		name: t("plugins.obs.actions.refresh_browser.name"),
		description: t("plugins.obs.actions.refresh_browser.description"),
		icon: "mdi mdi-refresh",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					name: t("plugins.obs.common.source"),
					required: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const textInputs = await context.obs.getInputs("browser_source")
						return textInputs
					},
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (!config.obs.state.connected) return

			await config.obs.connection.call("PressInputPropertiesButton", {
				inputName: config.sourceName,
				propertyName: "refreshnocache",
			})
		},
	})

	defineAction({
		id: "setBrowserURL",
		name: t("plugins.obs.actions.set_browser_url.name"),
		icon: "mdi mdi-refresh",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					name: t("plugins.obs.common.source"),
					required: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const textInputs = await context.obs.getInputs("browser_source")
						return textInputs
					},
				},
				url: {
					type: String,
					name: t("plugins.obs.common.url"),
					required: true,
					template: true,
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (!config.obs.state.connected) return

			await config.obs.connection.call("SetInputSettings", {
				inputName: config.sourceName,
				inputSettings: {
					url: config.url,
				},
			})
		},
	})

	defineAction({
		id: "setImage",
		name: t("plugins.obs.actions.set_image.name"),
		description: t("plugins.obs.actions.set_image.description"),
		icon: "mdi mdi-refresh",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				sourceName: {
					type: String,
					name: t("plugins.obs.common.source"),
					required: true,
					async enum(context: { obs: OBSConnection }) {
						const obs = context?.obs?.connection
						if (!obs) return []

						const textInputs = await context.obs.getInputs("image_source")

						return textInputs
					},
				},
				image: {
					type: MediaFile,
					name: t("plugins.obs.actions.set_image.config.image"),
					image: true,
					required: true,
					template: true,
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (!config.obs.state.connected) return

			//TODO: Wtf types?
			let imagePath = config.image as string

			if (MediaManager.getInstance().isMediaPath(config.image)) {
				if (config.obs.isLocal) {
					imagePath = MediaManager.getInstance().getLocalPath(imagePath)
				} else {
					if (await MediaManager.getInstance().validateRemoteMediaPath(imagePath)) {
						imagePath = `${WebService.getInstance().remoteBaseUrl}/media/${imagePath}`
					}
				}
			}

			await config.obs.connection.call("SetInputSettings", {
				inputName: config.sourceName,
				inputSettings: {
					file: imagePath,
				},
			})
		},
	})
}
