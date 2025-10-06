import { RetryTimer, definePluginResource, defineResourceSetting } from "castmate-core"
import { RCONConnectionConfig, RCONConnectionState } from "castmate-plugin-minecraft-shared"
import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	FileResource,
	ResourceStorage,
} from "castmate-core"
import RCon from "ts-rcon"
import { nanoid } from "nanoid/non-secure"
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

registerPluginTranslations("minecraft", generatedTranslationsFromFiles(translationFiles))

export class RCONConnection extends FileResource<RCONConnectionConfig, RCONConnectionState> {
	static resourceDirectory = "./minecraft/connections"
	static storage = new ResourceStorage<RCONConnection>("RCONConnection")

	client: RCon | undefined
	retryTimer: RetryTimer

	constructor(config?: RCONConnectionConfig) {
		super()

		if (config) {
			this._id = nanoid()
			this._config = config
		} else {
			//@ts-ignore
			this._config = {}
		}

		this.state = {
			connected: false,
		}

		this.retryTimer = new RetryTimer(() => {
			this.client = new RCon(this.config.host, this.config.port, this.config.password)

			this.client.on("error", () => { })

			this.client.on("end", () => {
				this.state.connected = false
				this.retryTimer.tryAgain()
			})

			this.client.on("auth", () => {
				this.state.connected = true
			})
		}, 60)
	}

	async load(savedConfig: RCONConnectionConfig): Promise<boolean> {
		const result = await super.load(savedConfig)
		await this.retryTimer.tryNow()
		return result
	}

	static async onCreate(resource: RCONConnection): Promise<void> {
		await resource.retryTimer.tryNow()
	}

	async sendCommand(command: string) {
		this.client?.send(command)
	}
}

export default definePlugin(
	{
		id: "minecraft",
		name: t("plugins.minecraft.plugin.name"),
		description: t("plugins.minecraft.plugin.description"),
		icon: "mdi mdi-minecraft",
		color: "#66A87B",
	},
	() => {
		definePluginResource(RCONConnection)

		defineResourceSetting(RCONConnection, "RCON Connections")

		defineAction({
			id: "mineCmd",
			name: t("plugins.minecraft.actions.mineCmd.name"),
			description: t("plugins.minecraft.actions.mineCmd.description"),
			icon: "mdi mdi-minecraft",
			config: {
				type: Object,
				properties: {
					server: { type: RCONConnection, name: t("plugins.minecraft.common.server"), required: true },
					command: { type: String, name: t("plugins.minecraft.common.command"), required: true, default: "", template: true },
				},
			},
			async invoke(config, contextData, abortSignal) {
				//TODO: Wait for response somehow?
				await config.server?.sendCommand(config.command)
			},
		})
	}
)
