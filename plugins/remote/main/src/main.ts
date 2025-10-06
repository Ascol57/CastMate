import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	onWebsocketMessage,
	useHTTPRouter,
	ProfileManager,
	Profile,
	usePluginLogger,
} from "castmate-core"
import { handleDashboardWidgetRPC } from "castmate-plugin-dashboards-main/src/dashboard-access"
import { isString } from "castmate-schema"
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

registerPluginTranslations("remote", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "remote",
		name: t("plugins.remote.plugin.name"),
		description: t("plugins.remote.plugin.description"),
		icon: "mdi mdi-remote",
		color: "#D554FF",
	},
	() => {
		const logger = usePluginLogger()
		const httpRoutes = useHTTPRouter("remote")

		const remoteButton = defineTrigger({
			id: "button",
			name: t("plugins.remote.triggers.button.name"),
			icon: "mdi mdi-remote",
			description: t("plugins.remote.triggers.button.description"),
			config: {
				type: Object,
				properties: {
					name: { type: String, name: t("plugins.remote.common.button"), required: true },
				},
			},
			context: {
				type: Object,
				properties: {
					name: { type: String, name: t("plugins.remote.common.button"), required: true, view: false },
				},
			},
			async handle(config, context, mapping) {
				return config.name == context.name
			},
		})

		handleDashboardWidgetRPC("pressbutton", (dashboard, widgetId, triggerName: string) => {
			const widget = dashboard.getWidget(widgetId)
			if (!widget) return

			const remoteName = "triggerName" in widget.config ? (widget.config.triggerName as string) : undefined

			if (!remoteName) return

			remoteButton({ name: remoteName })
		})

		onLoad(() => {
			httpRoutes.get("/buttons", (req, res, next) => {
				const names = new Set<string>()

				for (const profile of Profile.storage) {
					for (const trigger of profile.iterTriggers(remoteButton)) {
						names.add(trigger.config.name)
					}
				}

				res.send({
					buttons: Array.from(names),
				})

				next()
			})

			httpRoutes.post("/buttons/press", (req, res, next) => {
				const buttonName = req.query["button"]

				if (!buttonName || !isString(buttonName)) {
					return res.status(404).send()
				}

				remoteButton({
					name: buttonName,
				})

				res.status(204).send()
				next()
			})
		})
	}
)
