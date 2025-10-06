import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	useHTTPRouter,
	onProfilesChanged,
	resetRouter,
	coreAxios,
} from "castmate-core"
import axios from "axios"
import { t } from "castmate-translation"

export default definePlugin(
	{
		id: "http",
		name: t("plugins.http.plugin.name"),
		description: t("plugins.http.plugin.description"),
		icon: "mdi mdi-web",
		color: "#9E436E",
	},
	() => {
		const endpointRoutes = useHTTPRouter("endpoints")

		defineAction({
			id: "request",
			name: t("plugins.http.actions.request.name"),
			description: t("plugins.http.actions.request.description"),
			icon: "mdi mdi-web",
			config: {
				type: Object,
				properties: {
					method: {
						type: String,
						name: t("plugins.http.common.method"),
						enum: ["GET", "POST", "DELETE", "PUT", "PATCH"],
						required: true,
						default: "GET",
					},
					url: {
						type: String,
						template: true,
						name: t("plugins.http.common.url"),
						required: true,
					},
					//TODO: Query
					//TODO: Headers
					//TODO: Body
				},
			},
			result: {
				type: Object,
				properties: {},
			},
			async invoke(config, contextData, abortSignal) {
				//TODO: Cancel Token
				const resp = await coreAxios.request({
					method: config.method,
					url: config.url,
				})

				return resp.data
			},
		})

		const endpointTrigger = defineTrigger({
			id: "endpoint",
			name: t("plugins.http.triggers.endpoint.name"),
			icon: "mdi mdi-server-network",
			description: t("plugins.http.triggers.endpoint.description"),
			config: {
				type: Object,
				properties: {
					method: {
						type: String,
						name: t("plugins.http.common.method"),
						enum: ["GET", "POST", "DELETE", "PUT", "PATCH"],
						default: "POST",
						required: true,
					},
					route: {
						type: String,
						name: t("plugins.http.common.route"),
						required: true,
					},
				},
			},
			context: {
				type: Object,
				properties: {
					method: { type: String, name: t("plugins.http.common.method"), required: true, view: false },
					route: { type: String, name: t("plugins.http.common.route"), required: true, view: false },
					params: { type: Object, name: t("plugins.http.common.params"), required: true, properties: {} },
					query: { type: Object, name: t("plugins.http.common.query"), required: true, properties: {} },
					body: { type: Object, name: t("plugins.http.common.body"), required: true, properties: {} },
				},
			},
			async handle(config, context, mapping) {
				return config.method == context.method && config.route == context.route
			},
		})

		onProfilesChanged((activeProfiles, inactiveProfiles) => {
			resetRouter(endpointRoutes)

			const routes: Record<string, Set<string>> = {
				GET: new Set<string>(),
				POST: new Set<string>(),
				DELETE: new Set<string>(),
				PUT: new Set<string>(),
				PATCH: new Set<string>(),
			}

			for (const profile of activeProfiles) {
				for (const trigger of profile.iterTriggers(endpointTrigger)) {
					const routeName = trigger.config.route

					routes[trigger.config.method]?.add(routeName)
				}
			}

			for (const method in routes) {
				for (const route of routes[method]) {
					endpointRoutes[method.toLowerCase() as "get" | "post" | "delete" | "put" | "patch"]?.(
						route,
						(req, res, next) => {
							endpointTrigger({
								method,
								route,
								params: req.params,
								query: req.query || {},
								body: req.body || {},
							})
							res.status(201).end()
							next()
						}
					)
				}
			}
		})
	}
)
