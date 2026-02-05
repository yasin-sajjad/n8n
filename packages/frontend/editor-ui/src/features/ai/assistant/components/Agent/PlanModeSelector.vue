<script setup lang="ts">
import { computed } from 'vue';

import { N8nRadioButtons } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

type BuilderMode = 'build' | 'plan';

const props = defineProps<{
	modelValue: BuilderMode;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: BuilderMode];
}>();

const i18n = useI18n();

const options = computed(() => [
	{
		label: i18n.baseText('aiAssistant.builder.planMode.selector.build'),
		value: 'build' as const,
	},
	{
		label: i18n.baseText('aiAssistant.builder.planMode.selector.plan'),
		value: 'plan' as const,
	},
]);

function onUpdate(value: BuilderMode) {
	emit('update:modelValue', value);
}
</script>

<template>
	<div :class="$style.container" data-test-id="plan-mode-selector">
		<N8nRadioButtons
			size="small"
			:model-value="props.modelValue"
			:options="options"
			:disabled="props.disabled"
			@update:model-value="onUpdate"
		/>
	</div>
</template>

<style module lang="scss">
.container {
	display: flex;
	align-items: center;
}
</style>
