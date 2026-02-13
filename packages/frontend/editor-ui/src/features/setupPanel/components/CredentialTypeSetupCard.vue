<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nIcon, N8nText, N8nTooltip } from '@n8n/design-system';

import CredentialIcon from '@/features/credentials/components/CredentialIcon.vue';
import CredentialPicker from '@/features/credentials/components/CredentialPicker/CredentialPicker.vue';
import TriggerExecuteButton from './TriggerExecuteButton.vue';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useTelemetry } from '@/app/composables/useTelemetry';
import { getAppNameFromCredType } from '@/app/utils/nodeTypesUtils';

import type { CredentialTypeSetupState } from '../setupPanel.types';

const props = defineProps<{
	state: CredentialTypeSetupState;
}>();

const expanded = defineModel<boolean>('expanded', { default: false });

const emit = defineEmits<{
	credentialSelected: [payload: { credentialType: string; credentialId: string }];
	credentialDeselected: [credentialType: string];
}>();

const i18n = useI18n();
const telemetry = useTelemetry();
const workflowsStore = useWorkflowsStore();

const hadManualInteraction = ref(false);

const onHeaderClick = () => {
	expanded.value = !expanded.value;
};

const onCredentialSelected = (credentialId: string) => {
	hadManualInteraction.value = true;
	emit('credentialSelected', {
		credentialType: props.state.credentialType,
		credentialId,
	});
};

const onCredentialDeselected = () => {
	hadManualInteraction.value = true;
	emit('credentialDeselected', props.state.credentialType);
};

const nodeNamesTooltip = computed(() => props.state.nodeNames.join(', '));

const cardTitle = computed(() => {
	if (props.state.isGenericAuth) {
		return i18n.baseText('setupPanel.cardTitle.generic', {
			interpolate: { credentialName: props.state.credentialDisplayName },
		});
	}
	return i18n.baseText('setupPanel.cardTitle.service', {
		interpolate: { serviceName: getAppNameFromCredType(props.state.credentialDisplayName) },
	});
});

watch(
	() => props.state.isComplete,
	(isComplete) => {
		if (isComplete) {
			expanded.value = false;

			if (hadManualInteraction.value) {
				telemetry.track('User completed setup step', {
					template_id: workflowsStore.workflow.meta?.templateId,
					workflow_id: workflowsStore.workflowId,
					type: 'credential',
					credential_type: props.state.credentialType,
					related_nodes_count: props.state.nodeNames.length,
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
		data-test-id="credential-type-setup-card"
		:class="[
			$style.card,
			{
				[$style.collapsed]: !expanded,
				[$style.completed]: state.isComplete,
				[$style['has-content']]: state.credentialType,
			},
		]"
	>
		<header
			data-test-id="credential-type-setup-card-header"
			:class="$style.header"
			@click="onHeaderClick"
		>
			<N8nIcon
				v-if="!expanded && state.isComplete"
				data-test-id="credential-type-setup-card-complete-icon"
				icon="check"
				:class="$style['complete-icon']"
				size="medium"
			/>
			<CredentialIcon v-else :credential-type-name="state.credentialType" :size="16" />
			<N8nText :class="$style['credential-name']" size="medium" color="text-dark">
				{{ cardTitle }}
			</N8nText>
			<N8nIcon
				:class="$style['header-icon']"
				:icon="expanded ? 'chevrons-down-up' : 'chevrons-up-down'"
				size="medium"
				color="text-light"
			/>
		</header>

		<template v-if="expanded">
			<div :class="$style.content" class="pb-s">
				<div :class="$style['credential-container']">
					<div :class="$style['credential-label-row']">
						<label
							data-test-id="credential-type-setup-card-label"
							:for="`credential-picker-${state.credentialType}`"
							:class="$style['credential-label']"
						>
							{{ i18n.baseText('setupPanel.credentialLabel') }}
						</label>
						<N8nTooltip v-if="state.nodeNames.length > 1" placement="top">
							<template #content>
								{{ nodeNamesTooltip }}
							</template>
							<span
								data-test-id="credential-type-setup-card-nodes-hint"
								:class="$style['nodes-hint']"
							>
								{{
									i18n.baseText('setupPanel.usedInNodes', {
										interpolate: { count: String(state.nodeNames.length) },
									})
								}}
							</span>
						</N8nTooltip>
					</div>
					<CredentialPicker
						create-button-type="secondary"
						:class="$style['credential-picker']"
						:app-name="state.credentialDisplayName"
						:credential-type="state.credentialType"
						:selected-credential-id="state.selectedCredentialId ?? null"
						@credential-selected="onCredentialSelected"
						@credential-deselected="onCredentialDeselected"
					/>
				</div>
			</div>

			<footer v-if="state.triggerNodes.length > 0 || state.isComplete" :class="$style.footer">
				<div v-if="state.isComplete" :class="$style['footer-complete-check']">
					<N8nIcon icon="check" :class="$style['complete-icon']" size="large" />
					<N8nText size="medium" color="success">
						{{ i18n.baseText('generic.complete') }}
					</N8nText>
				</div>
				<div v-if="state.triggerNodes.length > 0" :class="$style['footer-trigger-buttons']">
					<TriggerExecuteButton
						v-for="triggerNode in state.triggerNodes"
						:key="triggerNode.id"
						:node="triggerNode"
						@executed="hadManualInteraction = true"
					/>
				</div>
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

	&.has-content {
		footer {
			padding-top: 0;
		}
	}
}

.header {
	display: flex;
	gap: var(--spacing--xs);
	cursor: pointer;
	user-select: none;
	padding: var(--spacing--sm) var(--spacing--sm) 0;

	.header-icon {
		display: none;
	}

	&:hover {
		.header-icon {
			display: block;
		}
	}

	.card:not(.collapsed) & {
		margin-bottom: var(--spacing--sm);
	}
}

.credential-name {
	flex: 1;
	font-weight: var(--font-weight--medium);
}

.complete-icon {
	color: var(--color--success);
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding: 0 var(--spacing--sm);
}

.credential-container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
}

.credential-label-row {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.credential-label {
	font-size: var(--font-size--sm);
	color: var(--color--text--shade-1);
}

.nodes-hint {
	font-size: var(--font-size--sm);
	color: var(--color--text--tint-1);
	cursor: default;
}

.credential-picker {
	flex: 1;
}

.footer {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	padding: var(--spacing--sm);
}

.footer-complete-check {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.footer-trigger-buttons {
	display: flex;
	gap: var(--spacing--2xs);
	margin-left: auto;
}

.card.collapsed {
	.header {
		padding: var(--spacing--sm);
	}

	.credential-name {
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
