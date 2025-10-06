import { defineAction, defineTrigger, onLoad, onUnload, definePlugin } from "castmate-core"
import { setupPowershell } from "./powershell"
import { setupProcesses, isProcessRunning } from "./processes"
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

registerPluginTranslations("os", generatedTranslationsFromFiles(translationFiles))

export { isProcessRunning }

export default definePlugin(
	{
		id: "os",
		name: t("plugins.os.plugin.name"),
		description: t("plugins.os.plugin.description"),
		icon: "mdi mdi-laptop",
		color: "#CC9B78",
	},
	() => {
		//Plugin Intiialization
		setupPowershell()
		setupProcesses()
	}
)
