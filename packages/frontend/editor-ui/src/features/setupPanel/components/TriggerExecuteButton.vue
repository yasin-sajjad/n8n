<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nTooltip } from '@n8n/design-system';

import type { INodeUi } from '@/Interface';
import { useNodeExecution } from '@/app/composables/useNodeExecution';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { getTriggerNodeServiceName } from '@/app/utils/nodeTypesUtils';

const props = defineProps<{
	node: INodeUi;
}>();

const emit = defineEmits<{
	executed: [];
}>();

const i18n = useI18n();
const nodeTypesStore = useNodeTypesStore();

const nodeRef = computed(() => props.node);
const {
	isExecuting,
	isListening,
	isListeningForWorkflowEvents,
	buttonLabel,
	buttonIcon,
	disabledReason,
	hasIssues,
	execute,
} = useNodeExecution(nodeRef);

const nodeType = computed(() =>
	nodeTypesStore.getNodeType(props.node.type, props.node.typeVersion),
);

const isInListeningState = computed(() => isListening.value || isListeningForWorkflowEvents.value);

const listeningHint = computed(() => {
	if (!isInListeningState.value || !nodeType.value) return '';

	if (nodeType.value.eventTriggerDescription) {
		return nodeType.value.eventTriggerDescription;
	}

	const serviceName = getTriggerNodeServiceName(nodeType.value);
	return i18n.baseText('setupPanel.trigger.listeningHint', {
		interpolate: { service: serviceName },
	});
});

const label = computed(() => {
	if (isInListeningState.value) {
		return i18n.baseText('ndv.execute.stopListening');
	}
	return buttonLabel.value;
});

const isButtonDisabled = computed(
	() => isExecuting.value || hasIssues.value || !!disabledReason.value,
);

const tooltipText = computed(() => {
	if (isInListeningState.value) {
		return listeningHint.value;
	}
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
	<N8nTooltip
		:visible="isInListeningState ? true : undefined"
		:disabled="!tooltipText"
		placement="top"
	>
		<template #content>{{ tooltipText }}</template>
		<N8nButton
			data-test-id="trigger-execute-button"
			:label="label"
			:disabled="isButtonDisabled"
			:loading="isExecuting"
			:icon="buttonIcon"
			size="small"
			@click="onTestClick"
		/>
	</N8nTooltip>
</template>
