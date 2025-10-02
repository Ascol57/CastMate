import { useResourceStore, ResourceSettingList, ResourceSchemaEdit, tSync } from "castmate-ui-core"
import "./css/discord.css"

export function initPlugin() {
	const resourceStore = useResourceStore()

	resourceStore.registerSettingComponent("DiscordWebhook", ResourceSettingList)
	resourceStore.registerEditComponent("DiscordWebhook", ResourceSchemaEdit)
	resourceStore.registerCreateComponent("DiscordWebhook", ResourceSchemaEdit)

	resourceStore.registerConfigSchema("DiscordWebhook", {
		type: Object,
		properties: {
			name: { type: String, name: tSync("plugins.discord.renderer.connection.name"), required: true },
			webhookUrl: { type: String, name: tSync("plugins.discord.renderer.connection.webhook_url"), required: true, secret: true },
		},
	})
}
