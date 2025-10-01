<template>
	<div class="transform-input" v-if="model">
		<obs-transform-data-group
			v-model="model.position"
			inner-class="flex flex-row gap-1"
			:label="tSync('plugins.obs.renderer.transform.position')"
			local-path="position"
		>
			<obs-transform-number-input
				:label="tSync('plugins.obs.renderer.transform.x')"
				v-model="model.position.x"
				input-id="x"
				ws-prop="positionX"
				:can-template="canTemplate"
				unit="px"
				local-path="x"
			></obs-transform-number-input>
			<obs-transform-number-input
				:label="tSync('plugins.obs.renderer.transform.y')"
				v-model="model.position.y"
				input-id="y"
				ws-prop="positionY"
				:can-template="canTemplate"
				unit="px"
				local-path="y"
			></obs-transform-number-input>
		</obs-transform-data-group>
		<obs-transform-number-input
			:label="tSync('plugins.obs.renderer.transform.rotation')"
			v-model="model.rotation"
			input-id="rotation"
			ws-prop="rotation"
			:can-template="canTemplate"
			unit="deg"
			local-path="rotation"
		/>
		<obs-transform-enum-input
			:label="tSync('plugins.obs.renderer.transform.alignment')"
			v-model="model.alignment"
			input-id="boundsAlignment"
			ws-prop="boundsAlignment"
			:enum="alignmentEnum"
			local-path="alignment"
		/>
		<obs-transform-data-group
			v-model="model.scale"
			inner-class="flex flex-row gap-1"
			:label="tSync('plugins.obs.renderer.transform.size')"
			local-path="scale"
		>
			<template #before>
				<p class="text-color-secondary text-sm m-0">
					{{ tSync('plugins.obs.renderer.transform.size_note') }}
				</p>
			</template>
			<obs-transform-number-input
				:label="tSync('plugins.obs.renderer.transform.x')"
				v-model="model.scale.x"
				input-id="x"
				ws-prop="scaleY"
				:can-template="canTemplate"
				unit="px"
				local-path="x"
			/>
			<obs-transform-number-input
				:label="tSync('plugins.obs.renderer.transform.y')"
				v-model="model.scale.y"
				input-id="y"
				ws-prop="scaleY"
				:can-template="canTemplate"
				unit="px"
				local-path="y"
			/>
		</obs-transform-data-group>
		<obs-transform-data-group v-model="model.crop" :label="tSync('plugins.obs.renderer.transform.crop')" local-path="crop">
			<div class="flex flex-row justify-content-center">
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.top')"
					v-model="model.crop.top"
					input-id="top"
					ws-prop="cropTop"
					:can-template="canTemplate"
					local-path="top"
				/>
			</div>
			<div class="flex flex-row justify-content-center gap-1">
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.left')"
					v-model="model.crop.left"
					input-id="cropLeft"
					ws-prop="cropLeft"
					:can-template="canTemplate"
					local-path="left"
				/>
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.right')"
					v-model="model.crop.right"
					input-id="x"
					ws-prop="cropRight"
					:can-template="canTemplate"
					local-path="right"
				/>
			</div>
			<div class="flex flex-row justify-content-center">
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.bottom')"
					v-model="model.crop.bottom"
					input-id="cropBottom"
					ws-prop="cropBottom"
					:can-template="canTemplate"
					local-path="bottom"
				/>
			</div>
		</obs-transform-data-group>
		<obs-transform-data-group :label="tSync('plugins.obs.renderer.transform.bounds')" v-model="model.boundingBox" local-path="boundingBox">
			<obs-transform-enum-input
				:label="tSync('plugins.obs.renderer.transform.alignment')"
				v-model="model.boundingBox.alignment"
				input-id="boundsAlignment"
				ws-prop="boundsAlignment"
				:enum="alignmentEnum"
				local-path="alignment"
			/>
			<obs-transform-enum-input
				:label="tSync('plugins.obs.renderer.transform.bounds_type')"
				v-model="model.boundingBox.boxType"
				input-id="boundsType"
				ws-prop="boundsType"
				:enum="boundsTypeEnum"
				local-path="boxType"
			/>
			<div class="flex flex-row justify-content-center gap-1">
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.width')"
					v-model="model.boundingBox.width"
					input-id="boundsWidth"
					ws-prop="boundsWidth"
					:can-template="canTemplate"
					local-path="width"
				/>
				<obs-transform-number-input
					:label="tSync('plugins.obs.renderer.transform.height')"
					v-model="model.boundingBox.height"
					input-id="boundsHeight"
					ws-prop="boundsHeight"
					:can-template="canTemplate"
					local-path="height"
				/>
			</div>
		</obs-transform-data-group>
	</div>
</template>

<script setup lang="ts">
import { OBSSourceTransform, SchemaOBSSourceTransform, OBSBoundsType, OBSAlignment } from "castmate-plugin-obs-shared"
import { SharedDataInputProps, CAutocomplete, LabelFloater, useDataBinding, tSync } from "castmate-ui-core"
import { useModel, computed } from "vue"

import ObsTransformDataGroup from "./ObsTransformDataGroup.vue"
import ObsTransformNumberInput from "./ObsTransformNumberInput.vue"
import ObsTransformEnumInput from "./ObsTransformEnumInput.vue"

const props = defineProps<
	{
		modelValue: OBSSourceTransform | undefined
		schema: SchemaOBSSourceTransform
	} & SharedDataInputProps
>()

useDataBinding(() => props.localPath)

const model = useModel(props, "modelValue")

const canTemplate = computed(() => props.schema.template == true)

const alignmentEnum = computed<
	{
		name: string
		value: OBSAlignment
	}[]
>(() => {
	return [
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.center"), value: OBSAlignment.OBS_ALIGN_CENTER },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.left"), value: OBSAlignment.OBS_ALIGN_LEFT },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.right"), value: OBSAlignment.OBS_ALIGN_RIGHT },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.top"), value: OBSAlignment.OBS_ALIGN_TOP },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.bottom"), value: OBSAlignment.OBS_ALIGN_BOTTOM },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.top_left"), value: OBSAlignment.OBS_ALIGN_TOP_LEFT },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.top_right"), value: OBSAlignment.OBS_ALIGN_TOP_RIGHT },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.bottom_left"), value: OBSAlignment.OBS_ALIGN_BOTTOM_LEFT },
		{ name: tSync("plugins.obs.renderer.transform.alignment_values.bottom_right"), value: OBSAlignment.OBS_ALIGN_BOTTOM_RIGHT },
	]
})

const boundsTypeEnum = computed<{ name: string; value: OBSBoundsType }[]>(() => {
	return [
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.none"), value: "OBS_BOUNDS_NONE" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.stretch"), value: "OBS_BOUNDS_STRETCH" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.scale_inner"), value: "OBS_BOUNDS_SCALE_INNER" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.scale_outer"), value: "OBS_BOUNDS_SCALE_OUTER" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.scale_to_width"), value: "OBS_BOUNDS_SCALE_TO_WIDTH" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.scale_to_height"), value: "OBS_BOUNDS_SCALE_TO_HEIGHT" },
		{ name: tSync("plugins.obs.renderer.transform.bounds_type_values.max_only"), value: "OBS_BOUNDS_MAX_ONLY" },
	]
})
</script>

<style scoped>
.transform-input {
	background-color: var(--surface-a);
	padding: 0.5rem;
	border-radius: var(--border-radius);
}
</style>
