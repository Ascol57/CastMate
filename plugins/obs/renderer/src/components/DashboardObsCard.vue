<template>
	<main-page-card v-if="obs">
		<template #header>
			<div class="flex flex-row">
				<i class="obsi obsi-obs" /> {{ obs?.config?.name }}
				<div class="flex-grow-1" />
				<p-button
					v-if="obs.state.connected"
					icon="mdi mdi-refresh"
					size="small"
					class="extra-small-button"
					v-tooltip="tSync('plugins.obs.renderer.dashboard_card.refresh_all_browsers')"
					@click="refreshAllBrowsers"
				/>
			</div>
		</template>
		<main-page-card-item v-if="!obs.state.connected" :label="tSync('plugins.obs.renderer.dashboard_card.disconnected')">
			<p-button v-if="isLocal" text @click="openObs">{{ tSync('plugins.obs.renderer.dashboard_card.open') }}</p-button>
			<div
				class="p-text-secondary"
				style="font-size: 0.875rem"
				v-else
				:v-tooltip="tSync('plugins.obs.renderer.dashboard_card.remote_obs_tooltip')"
			>
				{{ tSync('plugins.obs.renderer.dashboard_card.remote_obs') }}
			</div>
		</main-page-card-item>
		<template v-else-if="obs.state.connected">
			<main-page-card-item :label="tSync('plugins.obs.renderer.dashboard_card.streaming')">
				<i
					:style="{ color: obs.state.streaming ? 'blue' : 'var(--surface-300)' }"
					:class="obs.state.streaming ? 'mdi mdi-broadcast' : 'mdi mdi-broadcast-off'"
				/>
			</main-page-card-item>
			<main-page-card-item :label="tSync('plugins.obs.renderer.dashboard_card.recording')">
				<i
					:style="{ color: obs.state.recording ? 'red' : 'var(--surface-300)' }"
					:class="obs.state.recording ? 'mdi mdi-record' : 'mdi mdi-record'"
				/>
			</main-page-card-item>
		</template>
	</main-page-card>
</template>

<script setup lang="ts">
import { useResource, MainPageCard, MainPageCardItem, useResourceIPCCaller, tSync } from "castmate-ui-core"
import { OBSConnectionConfig, OBSConnectionState } from "castmate-plugin-obs-shared"
import { ResourceData } from "castmate-schema"
import { computed } from "vue"
import PButton from "primevue/button"

const props = defineProps<{
	obsId: string
}>()

const obs = useResource<ResourceData<OBSConnectionConfig, OBSConnectionState>>("OBSConnection", () => props.obsId)

const isLocal = computed(() => {
	if (!obs.value) return
	return obs.value.config.host == "127.0.0.1" || obs.value.config.host == "localhost"
})

const openProcess = useResourceIPCCaller<() => any>("OBSConnection", () => props.obsId, "openProcess")
const refreshAllBrowsers = useResourceIPCCaller<() => any>("OBSConnection", () => props.obsId, "refreshAllBrowsers")

async function openObs() {
	if (!props.obsId) return
	await openProcess()
}
</script>

<style scoped>
.obs-card {
	height: var(--dashboard-height);
	border-radius: var(--border-radius);
	border: solid 2px var(--surface-border);
	padding: 0rem;
	display: flex;
	flex-direction: row;
}
</style>
