import { LightColor, LightConfig, LightState } from "castmate-plugin-iot-shared"
import {
	Resource,
	ResourceStorage,
	SatelliteResources,
	SatelliteService,
	abortableSleep,
	defineAction,
	definePluginResource,
	defineSatelliteResourceSlotHandler,
	isSatellite,
	registerSchemaTemplate,
	template,
} from "castmate-core"
import { Duration, Toggle } from "castmate-schema"
import { SatelliteResourceSymbol } from "castmate-core"
import { t } from "castmate-translation"

export class LightResource<
	Config extends LightConfig = LightConfig,
	State extends LightState = LightState
> extends Resource<Config, State> {
	static storage = new ResourceStorage<LightResource>("Light")

	async setLightState(color: LightColor | undefined, on: Toggle, transition: Duration) { }
}

export class PollingLight<
	Config extends LightConfig = LightConfig,
	State extends LightState = LightState
> extends LightResource<Config, State> {
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

registerSchemaTemplate(LightColor, async (value, context, schema) => {
	return (await template(value, context)) as LightColor
})

export class SatelliteLight extends LightResource {
	static [SatelliteResourceSymbol] = true

	constructor() {
		super()
		this._config = {
			name: "",
			provider: "satellite",
			providerId: "",
			rgb: {
				available: true,
			},
			kelvin: {
				available: true,
			},
			dimming: {
				available: true,
			},
			transitions: {
				available: true,
			},
		}

		this.state = {
			on: true,
			color: LightColor.factoryCreate(),
		}
	}

	async setLightState(color: LightColor | undefined, on: Toggle, transition: Duration): Promise<void> {
		await SatelliteResources.getInstance().callResourceRPC(this.id, "setLightState", color, on, transition)
	}
}

export function setupLights() {
	definePluginResource(LightResource)

	defineSatelliteResourceSlotHandler(LightResource, {
		satelliteConstructor: SatelliteLight,
		rpcs: {
			async setLightState(resource, color: LightColor | undefined, on: Toggle, transition: Duration) {
				await resource.setLightState(color, on, transition)
			},
		},
	})

	if (isSatellite()) return

	//TODO: Make satellite ignore this!
	defineAction({
		id: "light",
		name: t("plugins.iot.actions.light.name"),
		description: t("plugins.iot.actions.light.description"),
		icon: "mdi mdi-lightbulb-on-outline",
		duration: {
			dragType: "length",
			rightSlider: {
				sliderProp: "transition",
			},
		},
		config: {
			type: Object,
			properties: {
				light: { type: LightResource, name: t("plugins.iot.common.light"), required: true },
				on: {
					type: Toggle,
					name: t("plugins.iot.common.switch"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-lightbulb-on",
					falseIcon: "mdi mdi-lightbulb-outline",
				},
				lightColor: {
					type: LightColor,
					name: t("plugins.iot.common.color"),
					resource: "light",
					template: true,
				},
				transition: { type: Duration, name: t("plugins.iot.common.transition"), required: true, default: 0.5 },
			},
		},
		result: {
			type: Object,
			properties: {
				lightOn: { type: Boolean, name: t("plugins.iot.common.switch"), required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await Promise.allSettled([
				config.light?.setLightState(config.lightColor, config.on, config.transition),
				await abortableSleep(config.transition * 1000, abortSignal),
			])

			return {
				lightOn: config.light?.state?.on ?? false,
			}
		},
	})
}
