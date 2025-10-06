import {
	useResourceStore,
	ResourceSchemaEdit,
	useProjectStore,
	ProjectGroup,
	ProjectItem,
	useDockingStore,
	tSync,
} from "castmate-ui-core"
import "./css/icons.css"
import { computed, App } from "vue"
import { SpellConfigSchema, SpellResourceConfig } from "castmate-plugin-spellcast-shared"
import SpellCastPage from "./components/SpellCastPage.vue"
import { Color } from "castmate-schema"

export function initPlugin(app: App<Element>) {
	const resourceStore = useResourceStore()

	resourceStore.registerConfigSchema("SpellHook", {
		type: Object,
		properties: {
			name: { type: String, name: tSync("plugins.spellcast.SpellHook.name"), required: true, template: true },
			spellData: {
				type: Object,
				properties: {
					enabled: { type: Boolean, name: tSync("plugins.spellcast.SpellHook.enabled"), required: true, default: true },
					description: { type: String, name: tSync("plugins.spellcast.SpellHook.description"), template: true },
					bits: {
						name: tSync("plugins.spellcast.SpellHook.bits"),
						required: true,
						default: 10,
						type: Number,
						enum: [
							10, 20, 30, 40, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750,
							800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550,
							1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000,
						],
						template: true,
					},
					color: {
						type: Color,
						name: tSync("plugins.spellcast.SpellHook.color"),
						required: true,
						template: true,
						default: "#719ece",
						enum: ["#719ece", "#803FCC", "#CC3F9A", "#CCB23F", "#7ECC3F", "#CC4141", "#CC691E"],
					},
				},
			},
		},
	})
	resourceStore.registerEditComponent("SpellHook", ResourceSchemaEdit, async (id, data: SpellResourceConfig) => {
		await resourceStore.applyResourceConfig("SpellHook", id, {
			name: data.name,
			spellData: {
				...data.spellData,
			},
		})
	})
	resourceStore.registerCreateComponent("SpellHook", ResourceSchemaEdit)

	const projectStore = useProjectStore()
	const dockingStore = useDockingStore()

	projectStore.registerProjectGroupItem(
		computed<ProjectItem>(() => {
			return {
				id: "spellcast",
				title: tSync("plugins.spellcast.plugin.name"),
				icon: "sci sci-spellcast",
				open() {
					dockingStore.openPage("spellcast.spells", tSync("plugins.spellcast.plugin.name"), "sci sci-spellcast", SpellCastPage)
				},
			}
		})
	)
}
