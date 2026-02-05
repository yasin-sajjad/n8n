<script setup lang="ts">
import { computed, reactive } from 'vue';

import { N8nButton, N8nCheckbox, N8nInput, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

import type { PlanMode } from '../../assistant.types';

const props = defineProps<{
	message: PlanMode.QuestionsMessage;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	submit: [answers: PlanMode.QuestionResponse[]];
}>();

const i18n = useI18n();

type DraftAnswer = {
	selectedOptions: string[];
	customText: string;
};

const draftByQuestionId = reactive<Record<string, DraftAnswer>>({});

const questions = computed(() => props.message.data.questions);
const introMessage = computed(() => props.message.data.introMessage);

function getDraft(questionId: string): DraftAnswer {
	if (!draftByQuestionId[questionId]) {
		draftByQuestionId[questionId] = { selectedOptions: [], customText: '' };
	}
	return draftByQuestionId[questionId];
}

function setSingleOption(questionId: string, option: string) {
	getDraft(questionId).selectedOptions = option ? [option] : [];
}

function toggleMultiOption(questionId: string, option: string, checked: boolean) {
	const draft = getDraft(questionId);
	if (checked) {
		draft.selectedOptions = [...new Set([...draft.selectedOptions, option])];
		return;
	}
	draft.selectedOptions = draft.selectedOptions.filter((o) => o !== option);
}

const isSubmitDisabled = computed(() => props.disabled);

function onSubmit() {
	const answers: PlanMode.QuestionResponse[] = questions.value.map((q) => {
		const draft = getDraft(q.id);
		const selectedOptions = draft.selectedOptions;
		const customText = draft.customText.trim() || undefined;
		const skipped = selectedOptions.length === 0 && !customText;

		return {
			questionId: q.id,
			question: q.question,
			selectedOptions,
			customText,
			skipped,
		};
	});

	emit('submit', answers);
}
</script>

<template>
	<div :class="$style.message" data-test-id="plan-mode-questions-message">
		<div :class="$style.card">
			<N8nText size="small" bold>{{
				i18n.baseText('aiAssistant.builder.planMode.questions.title')
			}}</N8nText>
			<N8nText v-if="introMessage" size="small" color="text-base">{{ introMessage }}</N8nText>

			<div v-for="q in questions" :key="q.id" :class="$style.question">
				<N8nText size="small" bold>{{ q.question }}</N8nText>

				<div v-if="q.options?.length" :class="$style.options">
					<template v-if="q.type === 'single'">
						<N8nCheckbox
							v-for="opt in q.options"
							:key="opt"
							:label="opt"
							:model-value="getDraft(q.id).selectedOptions.includes(opt)"
							:disabled="disabled"
							@update:model-value="(checked: boolean) => setSingleOption(q.id, checked ? opt : '')"
						/>
					</template>
					<template v-else>
						<N8nCheckbox
							v-for="opt in q.options"
							:key="opt"
							:label="opt"
							:model-value="getDraft(q.id).selectedOptions.includes(opt)"
							:disabled="disabled"
							@update:model-value="(checked: boolean) => toggleMultiOption(q.id, opt, checked)"
						/>
					</template>
				</div>

				<N8nInput
					v-if="q.type === 'text' || q.allowCustom !== false"
					v-model="getDraft(q.id).customText"
					:disabled="disabled"
					:placeholder="i18n.baseText('aiAssistant.builder.planMode.questions.customPlaceholder')"
					size="small"
				/>
			</div>

			<div :class="$style.actions">
				<N8nButton
					type="primary"
					size="small"
					:disabled="isSubmitDisabled"
					data-test-id="plan-mode-questions-submit"
					@click="onSubmit"
				>
					{{ i18n.baseText('aiAssistant.builder.planMode.questions.submitButton') }}
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

.question {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding-top: var(--spacing--2xs);
	border-top: var(--border);

	&:first-of-type {
		border-top: 0;
		padding-top: 0;
	}
}

.options {
	display: grid;
	gap: var(--spacing--4xs);
}

.actions {
	display: flex;
	justify-content: flex-end;
	margin-top: var(--spacing--2xs);
}
</style>
