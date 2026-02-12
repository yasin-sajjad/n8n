<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nIcon, N8nText, N8nTooltip } from '@n8n/design-system';

import NodeIcon from '@/app/components/NodeIcon.vue';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useWorkflowsStore } from '@/app/stores/workflows.store';

import type { TriggerSetupState } from '../setupPanel.types';
import { useNodeExecution } from '@/app/composables/useNodeExecution';
import { useTelemetry } from '@/app/composables/useTelemetry';

const props = defineProps<{
	state: TriggerSetupState;
}>();

const expanded = defineModel<boolean>('expanded', { default: false });

const i18n = useI18n();
const telemetry = useTelemetry();
const nodeTypesStore = useNodeTypesStore();
const workflowsStore = useWorkflowsStore();

const nodeRef = computed(() => props.state.node);
const { isExecuting, buttonLabel, buttonIcon, disabledReason, hasIssues, execute } =
	useNodeExecution(nodeRef);

const nodeType = computed(() =>
	nodeTypesStore.getNodeType(props.state.node.type, props.state.node.typeVersion),
);

const isButtonDisabled = computed(
	() => isExecuting.value || hasIssues.value || !!disabledReason.value,
);

const tooltipText = computed(() => {
	if (hasIssues.value) {
		return i18n.baseText('ndv.execute.requiredFieldsMissing');
	}
	return disabledReason.value;
});

const onHeaderClick = () => {
	expanded.value = !expanded.value;
};

const hadManualInteraction = ref(false);

const onTestClick = async () => {
	hadManualInteraction.value = true;
	await execute();
};

watch(
	() => props.state.isComplete,
	(isComplete) => {
		if (isComplete) {
			expanded.value = false;

			if (hadManualInteraction.value) {
				telemetry.track('User completed setup step', {
					template_id: workflowsStore.workflow.meta?.templateId,
					workflow_id: workflowsStore.workflowId,
					type: 'trigger',
					node_type: props.state.node.type,
				});
				hadManualInteraction.value = false;
			}
		}
	},
);

onMounted(() => {
	if (props.state.isComplete) {
		expanded.value = false;
	}
});
</script>

<template>
	<div
		data-test-id="trigger-setup-card"
		:class="[
			$style.card,
			{
				[$style.collapsed]: !expanded,
				[$style.completed]: state.isComplete,
			},
		]"
	>
		<header data-test-id="trigger-setup-card-header" :class="$style.header" @click="onHeaderClick">
			<N8nIcon
				v-if="!expanded && state.isComplete"
				data-test-id="trigger-setup-card-complete-icon"
				icon="check"
				:class="$style['complete-icon']"
				size="medium"
			/>
			<NodeIcon v-else :node-type="nodeType" :size="16" />
			<N8nText :class="$style['node-name']" size="medium" color="text-dark">
				{{ state.node.name }}
			</N8nText>
			<N8nTooltip>
				<template #content>
					{{ i18n.baseText('nodeCreator.nodeItem.triggerIconTitle') }}
				</template>
				<N8nIcon
					:class="[$style['header-icon'], $style['trigger']]"
					icon="zap"
					size="small"
					color="text-light"
				/>
			</N8nTooltip>
			<N8nIcon
				:class="[$style['header-icon'], $style['chevron']]"
				:icon="expanded ? 'chevrons-down-up' : 'chevrons-up-down'"
				size="medium"
				color="text-light"
			/>
		</header>

		<template v-if="expanded">
			<footer :class="$style.footer">
				<div v-if="state.isComplete" :class="$style['footer-complete-check']">
					<N8nIcon icon="check" :class="$style['complete-icon']" size="large" />
					<N8nText size="medium" color="success">
						{{ i18n.baseText('generic.complete') }}
					</N8nText>
				</div>
				<N8nTooltip :disabled="!tooltipText" placement="top">
					<template #content>{{ tooltipText }}</template>
					<N8nButton
						data-test-id="trigger-setup-card-test-button"
						:label="buttonLabel"
						:disabled="isButtonDisabled"
						:loading="isExecuting"
						:icon="buttonIcon"
						size="small"
						@click="onTestClick"
					/>
				</N8nTooltip>
			</footer>
		</template>
	</div>
</template>

<style module lang="scss">
.card {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	background-color: var(--color--background--light-2);
	border: var(--border);
	border-radius: var(--radius);
}

.header {
	display: flex;
	gap: var(--spacing--xs);
	cursor: pointer;
	user-select: none;
	padding: var(--spacing--sm) var(--spacing--sm) 0;

	.header-icon {
		&.chevron {
			display: none;
		}
	}

	&:hover {
		.header-icon {
			&.chevron {
				display: block;
			}
			&.trigger {
				display: none;
			}
		}
	}

	.card:not(.collapsed) & {
		margin-bottom: var(--spacing--sm);
	}
}

.node-name {
	flex: 1;
	font-weight: var(--font-weight--medium);
}

.complete-icon {
	color: var(--color--success);
}

.footer {
	display: flex;
	justify-content: flex-end;
	padding: 0 var(--spacing--sm) var(--spacing--sm);
}

.footer-complete-check {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.card.collapsed {
	.header {
		padding: var(--spacing--sm);
	}

	.node-name {
		color: var(--color--text--tint-1);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
}

.card.completed {
	border-color: var(--color--success);

	.footer {
		justify-content: space-between;
	}
}
</style>
