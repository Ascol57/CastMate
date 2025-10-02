import { defineAction, defineTrigger, onLoad, onUnload, definePlugin, defineSatellitePlugin } from "castmate-core"
import { Dashboard, setupDashboardResources } from "./dashboard-resource"
import { DashboardWidgetManager } from "./dashboard-widgets"
import { setupConfigEval } from "./dashboard-config-eval"
import { DashboardAccessService, setupDashboardSatellite } from "./dashboard-access"
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

registerPluginTranslations("dashboards", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "dashboards",
		name: t("plugins.dashboards.plugin.name"),
		description: t("plugins.dashboards.plugin.description"),
		icon: "mdi mdi-pencil",
	},
	() => {
		setupDashboardSatellite()

		setupConfigEval()

		setupDashboardResources()
	}
)

export async function finishInitDashboards() {
	await Dashboard.finishInitResourceSlots()
}

export const dashboardSatellite = defineSatellitePlugin(
	{
		id: "dashboards",
		name: t("plugins.dashboards.plugin.name"),
		description: t("plugins.dashboards.plugin.description"),
		icon: "mdi mdi-pencil",
	},
	() => {
		onLoad(() => {
			DashboardWidgetManager.initialize()
			DashboardAccessService.initialize()
		})
	}
)
