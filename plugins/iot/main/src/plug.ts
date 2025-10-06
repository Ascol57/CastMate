import { PlugConfig, PlugState } from "castmate-plugin-iot-shared"
import {
	Resource,
	ResourceStorage,
	SatelliteResourceSymbol,
	SatelliteResources,
	defineAction,
	definePluginResource,
	defineSatelliteResourceSlotHandler,
	isSatellite,
	usePluginLogger,
} from "castmate-core"
import { Toggle } from "castmate-schema"
import { t } from "castmate-translation"

export class PlugResource<Config extends PlugConfig = PlugConfig, State extends PlugState = PlugState> extends Resource<
	Config,
	State
> {
	static storage = new ResourceStorage<PlugResource>("Plug")

	async setPlugState(on: Toggle) { }
}

export class SatellitePlug extends PlugResource {
	static [SatelliteResourceSymbol] = true

	constructor() {
		super()
		this._config = {
			name: "",
			provider: "satellite",
			providerId: "",
		}

		this.state = { on: true }
	}

	async setPlugState(on: Toggle): Promise<void> {
		await SatelliteResources.getInstance().callResourceRPC(this.id, "setPlugState", on)
	}
}

export class PollingPlug<
	Config extends PlugConfig = PlugConfig,
	State extends PlugState = PlugState
> extends PlugResource<Config, State> {
	poller: NodeJS.Timer | undefined = undefined

	startPolling(interval: number) {
		this.stopPolling()
		this.poller = setInterval(async () => {
			try {
				this.poll()
			} catch (err) { }
		}, interval * 1000)
	}

	stopPolling() {
		//@ts-expect-error
		clearInterval(this.poller)
		this.poller = undefined
	}

	async poll() { }
}

export function setupPlugs() {
	const logger = usePluginLogger()

	definePluginResource(PlugResource)

	defineSatelliteResourceSlotHandler(PlugResource, {
		satelliteConstructor: SatellitePlug,
		rpcs: {
			async setPlugState(resource, on: Toggle) {
				logger.log("Satellite Plug Toggle", on)
				await resource.setPlugState(on)
			},
		},
	})

	if (isSatellite()) return

	defineAction({
		id: "plug",
		name: t("plugins.iot.actions.plug.name"),
		description: t("plugins.iot.actions.plug.description"),
		icon: "mdi mdi-power-plug-outline",
		config: {
			type: Object,
			properties: {
				plug: { type: PlugResource, name: t("plugins.iot.common.plug"), required: true },
				switch: {
					type: Toggle,
					name: t("plugins.iot.common.switch"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-power-plug",
					falseIcon: "mdi mdi-power-plug-off",
				},
			},
		},
		result: {
			type: Object,
			properties: {
				plugOn: { type: Boolean, name: t("plugins.iot.common.plugOn"), required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await config.plug?.setPlugState(config.switch)

			return {
				plugOn: config.plug?.state?.on ?? false,
			}
		},
	})
}
