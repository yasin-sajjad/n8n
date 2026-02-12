<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nTooltip } from '@n8n/design-system';

import type { INodeUi } from '@/Interface';
import { useNodeExecution } from '@/app/composables/useNodeExecution';

const props = defineProps<{
	node: INodeUi;
}>();

const emit = defineEmits<{
	executed: [];
}>();

const i18n = useI18n();

const nodeRef = computed(() => props.node);
const { isExecuting, buttonLabel, buttonIcon, disabledReason, hasIssues, execute } =
	useNodeExecution(nodeRef);

const isButtonDisabled = computed(
	() => isExecuting.value || hasIssues.value || !!disabledReason.value,
);

const tooltipText = computed(() => {
	if (hasIssues.value) {
		return i18n.baseText('ndv.execute.requiredFieldsMissing');
	}
	return disabledReason.value;
});

const onTestClick = async () => {
	await execute();
	emit('executed');
};
</script>

<template>
	<N8nTooltip :disabled="!tooltipText" placement="top">
		<template #content>{{ tooltipText }}</template>
		<N8nButton
			data-test-id="trigger-execute-button"
			:label="buttonLabel"
			:disabled="isButtonDisabled"
			:loading="isExecuting"
			:icon="buttonIcon"
			size="small"
			@click="onTestClick"
		/>
	</N8nTooltip>
</template>
