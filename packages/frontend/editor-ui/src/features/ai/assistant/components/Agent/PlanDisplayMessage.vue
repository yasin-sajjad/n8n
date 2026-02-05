<script setup lang="ts">
import { computed, ref } from 'vue';

import { N8nButton, N8nInput, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import type { PlanMode } from '../../assistant.types';

const props = defineProps<{
	message: PlanMode.PlanMessage;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	decision: [value: { action: 'approve' | 'reject' | 'modify'; feedback?: string }];
}>();

const i18n = useI18n();
const feedback = ref('');

const plan = computed(() => props.message.data.plan);

function approve() {
	emit('decision', { action: 'approve' });
}

function modify() {
	emit('decision', { action: 'modify', feedback: feedback.value.trim() || undefined });
}

function reject() {
	emit('decision', { action: 'reject', feedback: feedback.value.trim() || undefined });
}
</script>

<template>
	<div :class="$style.message" data-test-id="plan-mode-plan-message">
		<div :class="$style.card">
			<N8nText size="small" bold>{{
				i18n.baseText('aiAssistant.builder.planMode.plan.title')
			}}</N8nText>

			<div :class="$style.section">
				<N8nText size="small" bold>{{ plan.summary }}</N8nText>
			</div>

			<div :class="$style.section">
				<N8nText size="small" bold>{{
					i18n.baseText('aiAssistant.builder.planMode.plan.triggerLabel')
				}}</N8nText>
				<N8nText size="small" color="text-base">{{ plan.trigger }}</N8nText>
			</div>

			<div :class="$style.section">
				<N8nText size="small" bold>{{
					i18n.baseText('aiAssistant.builder.planMode.plan.stepsLabel')
				}}</N8nText>
				<ol :class="$style.steps">
					<li v-for="(step, idx) in plan.steps" :key="idx">
						<N8nText size="small">{{ step.description }}</N8nText>
						<ul v-if="step.subSteps?.length" :class="$style.subSteps">
							<li v-for="(sub, subIdx) in step.subSteps" :key="subIdx">
								<N8nText size="small" color="text-base">{{ sub }}</N8nText>
							</li>
						</ul>
					</li>
				</ol>
			</div>

			<div v-if="plan.additionalSpecs?.length" :class="$style.section">
				<N8nText size="small" bold>{{
					i18n.baseText('aiAssistant.builder.planMode.plan.notesLabel')
				}}</N8nText>
				<ul :class="$style.notes">
					<li v-for="(note, idx) in plan.additionalSpecs" :key="idx">
						<N8nText size="small" color="text-base">{{ note }}</N8nText>
					</li>
				</ul>
			</div>

			<div :class="$style.section">
				<N8nText size="small" bold>{{
					i18n.baseText('aiAssistant.builder.planMode.plan.feedbackLabel')
				}}</N8nText>
				<N8nInput
					v-model="feedback"
					type="textarea"
					size="small"
					:disabled="disabled"
					:autosize="{ minRows: 2, maxRows: 6 }"
					:placeholder="i18n.baseText('aiAssistant.builder.planMode.plan.feedbackPlaceholder')"
				/>
			</div>

			<div :class="$style.actions">
				<N8nButton
					type="primary"
					size="small"
					:disabled="disabled"
					data-test-id="plan-mode-plan-approve"
					@click="approve"
				>
					{{ i18n.baseText('aiAssistant.builder.planMode.actions.implement') }}
				</N8nButton>
				<N8nButton
					type="secondary"
					size="small"
					:disabled="disabled"
					data-test-id="plan-mode-plan-modify"
					@click="modify"
				>
					{{ i18n.baseText('aiAssistant.builder.planMode.actions.modify') }}
				</N8nButton>
				<N8nButton
					type="tertiary"
					size="small"
					:disabled="disabled"
					data-test-id="plan-mode-plan-reject"
					@click="reject"
				>
					{{ i18n.baseText('aiAssistant.builder.planMode.actions.reject') }}
				</N8nButton>
			</div>
		</div>
	</div>
</template>

<style module lang="scss">
.message {
	margin-bottom: var(--spacing--sm);
	font-size: var(--font-size--sm);
	line-height: var(--line-height--xl);
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	border: var(--border);
	background-color: var(--color--background--light-3);
	border-radius: var(--radius--lg);
	padding: var(--spacing--xs);
}

.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.steps {
	margin: 0;
	padding-left: var(--spacing--md);
	display: grid;
	gap: var(--spacing--2xs);
}

.subSteps {
	margin: var(--spacing--4xs) 0 0 0;
	padding-left: var(--spacing--md);
	display: grid;
	gap: var(--spacing--4xs);
}

.notes {
	margin: 0;
	padding-left: var(--spacing--md);
	display: grid;
	gap: var(--spacing--4xs);
}

.actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--spacing--2xs);
	margin-top: var(--spacing--2xs);
}
</style>
