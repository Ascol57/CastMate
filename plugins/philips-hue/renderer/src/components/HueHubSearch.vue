<template>
	<div>
		<div class="text-centered">{{ tSync("plugins.philips-hue.renderer.hueHubSearch.title") }}</div>
		<div class="flex flex-column align-items-center justify-content-center">
			<div class="my-3">
				{{ tSync("plugins.philips-hue.renderer.hueHubSearch.description") }}
			</div>
			<p-button :loading="syncing" @click="doSearch">{{ buttonText }}</p-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useIpcCaller } from "castmate-ui-core"
import { computed, ref } from "vue"
import PButton from "primevue/button"
import { tSync } from "castmate-ui-core"

const findHueBridge = useIpcCaller<() => any>("philips-hue", "findHueBridge")

const syncing = ref(false)
const foundHub = ref(false)

const buttonText = computed(() => {
	if (syncing.value) {
		return tSync("plugins.philips-hue.renderer.hueHubSearch.searching")
	}

	if (foundHub.value) {
		return tSync("plugins.philips-hue.renderer.hueHubSearch.found")
	}

	return tSync("plugins.philips-hue.renderer.hueHubSearch.buttonText")
})

async function doSearch() {
	syncing.value = true
	foundHub.value = false
	foundHub.value = await findHueBridge()
	syncing.value = false
}
</script>
