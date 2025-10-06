import { defineAction, exposeSchema, onLoad, onUnload, usePluginLogger } from "castmate-core"
import { VariableManager } from "./variable-manager"
import { Duration, DynamicType, Range } from "castmate-schema"
import { t } from "castmate-translation"

export function setupVariableActions() {
	const logger = usePluginLogger()

	onLoad(async () => {
		VariableManager.initialize()
		await VariableManager.getInstance().load()
	})

	onUnload(async () => {
		VariableManager.getInstance().unload()
	})

	defineAction({
		id: "set",
		name: t("plugins.variables.actions.set.name"),
		description: t("plugins.variables.actions.set.description"),
		icon: "mdi mdi-variable",
		config: {
			type: Object,
			properties: {
				variable: {
					type: String,
					name: t("plugins.variables.common.variable"),
					required: true,
					async enum() {
						return VariableManager.getInstance().variableDefinitions.map((d) => d.id)
					},
				},
				value: {
					type: DynamicType,
					template: true,
					async dynamicType(context: { variable: string }) {
						const variable = VariableManager.getInstance().getVariable(context.variable)

						if (!variable) {
							return {
								type: String,
								name: t("plugins.variables.common.value"),
								required: true,
							}
						}

						return {
							...variable.schema,
							name: t("plugins.variables.common.value"),
							template: true,
						}
					},
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			const variable = VariableManager.getInstance().getVariable(config.variable)

			if (!variable) return //TODO: Log

			const exposedValue = await exposeSchema(variable.schema, config.value)

			variable.ref.value = exposedValue
		},
	})

	defineAction({
		id: "offset",
		name: t("plugins.variables.actions.offset.name"),
		description: t("plugins.variables.actions.offset.description"),
		icon: "mdi mdi-variable",
		config: {
			type: Object,
			properties: {
				variable: {
					type: String,
					name: t("plugins.variables.common.variable"),
					required: true,
					async enum() {
						return VariableManager.getInstance()
							.variableDefinitions.filter((v) => v.schema.type == Number || v.schema.type == Duration)
							.map((v) => v.id)
					},
				},
				offset: {
					type: DynamicType,
					template: true,
					async dynamicType(context: { variable: string }) {
						const variable = VariableManager.getInstance().getVariable(context.variable)

						if (!variable) {
							return {
								type: String,
								name: t("plugins.variables.common.value"),
								required: true,
								template: true,
							}
						}

						const result = {
							...variable.schema,
							name: t("plugins.variables.common.value"),
							template: true,
						}

						return result
					},
				},
				clamp: {
					type: Range,
					name: t("plugins.variables.common.clamp"),
					template: true,
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			const variable = VariableManager.getInstance().getVariable(config.variable)

			if (!variable) {
				logger.error("Missing Variable", config.variable)
				return
			}

			variable.ref.value = Range.clamp(config.clamp, variable.ref.value + config.offset)
		},
	})
}
