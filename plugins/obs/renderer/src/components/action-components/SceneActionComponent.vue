<template>
	<base-obs-action-component :obs="model.obs">
		<span class="text-center">{{ sceneName }}: {{ model.scene }}</span>
	</base-obs-action-component>
</template>

<script setup lang="ts">
import { tSync } from "castmate-ui-core"
import { computed } from "vue"
import BaseObsActionComponent from "./BaseObsActionComponent.vue"

const model = defineModel<{ obs: string; scene: string }>({ required: true })

// Example of using translations in a component
const sceneName = computed(() => {
	return tSync("actions.scene.config.scene")
})
</script>

<style scoped></style>
