import { DiscordWebhookConfig } from "castmate-plugin-discord-shared"
import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	FileResource,
	ResourceStorage,
	definePluginResource,
	defineResourceSetting,
	usePluginLogger,
} from "castmate-core"
import { t, registerPluginTranslations, generatedTranslationsFromFiles } from "castmate-translation"
import { WebhookClient } from "discord.js"
import { nanoid } from "nanoid/non-secure"
import { FilePath } from "castmate-schema"
import * as fs from "fs"
import { Stream } from "stream"

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

registerPluginTranslations("discord", generatedTranslationsFromFiles(translationFiles))

class DiscordWebHook extends FileResource<DiscordWebhookConfig> {
	static resourceDirectory = "./discord/webhooks"
	static storage = new ResourceStorage<DiscordWebHook>("DiscordWebhook")

	client: WebhookClient

	constructor(config?: DiscordWebhookConfig) {
		super()

		if (config) {
			this._id = nanoid()
			this._config = {
				...config,
			}

			this.client = new WebhookClient({ url: config.webhookUrl })
		} else {
			//@ts-ignore
			this._config = {}
		}
	}

	async load(savedConfig: DiscordWebhookConfig): Promise<boolean> {
		this.client = new WebhookClient({ url: savedConfig.webhookUrl })
		return await super.load(savedConfig)
	}

	async setConfig(config: DiscordWebhookConfig): Promise<boolean> {
		this.client = new WebhookClient({ url: config.webhookUrl })
		return await super.setConfig(config)
	}

	async applyConfig(config: Partial<DiscordWebhookConfig>): Promise<boolean> {
		if (!(await super.applyConfig(config))) return false
		this.client = new WebhookClient({ url: this.config.webhookUrl })
		return true
	}
}

export default definePlugin(
	{
		id: "discord",
		name: t("plugins.discord.plugin.name"),
		description: t("plugins.discord.plugin.description"),
		icon: "di di-discord",
		color: "#7289da",
	},
	() => {
		const logger = usePluginLogger()

		definePluginResource(DiscordWebHook)

		defineResourceSetting(DiscordWebHook, t("plugins.discord.settings.discord_webhooks.name"))

		defineAction({
			id: "discordMessage",
			name: t("plugins.discord.actions.discord_message.name"),
			icon: "mdi mdi-message",
			config: {
				type: Object,
				properties: {
					webhook: { type: DiscordWebHook, name: t("plugins.discord.actions.discord_message.config.webhook"), required: true },
					message: {
						type: String,
						name: t("plugins.discord.actions.discord_message.config.message"),
						required: true,
						default: "",
						template: true,
						multiLine: true,
					},
					files: {
						type: Array,
						name: t("plugins.discord.actions.discord_message.config.files"),
						items: {
							type: FilePath,
							name: t("plugins.discord.actions.discord_message.config.file"),
							template: true,
							required: true,
						},
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				let files: Stream[] | undefined = undefined

				if (config.files) {
					files = []
					for (const f of config.files) {
						try {
							const stream = fs.createReadStream(f)
							files.push(stream)
						} catch (err) {
							logger.error("Error opening file", f)
							logger.error(err)
						}
					}
				}

				await config.webhook?.client?.send({
					content: config.message,
					files,
				})
			},
		})
	}
)
