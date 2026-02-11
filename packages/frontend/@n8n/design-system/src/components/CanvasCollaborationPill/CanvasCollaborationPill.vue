<script setup lang="ts">
import { computed } from 'vue';

import { useI18n } from '../../composables/useI18n';
import N8nCanvasPill from '../CanvasPill';
import N8nAvatar from '../N8nAvatar';

defineOptions({
	name: 'N8nCanvasCollaborationPill',
});

const props = defineProps<{
	firstName: string;
	lastName?: string;
	isAnotherTab?: boolean;
}>();

const { t } = useI18n();

const userName = computed(() => {
	return props.lastName ? `${props.firstName} ${props.lastName}` : props.firstName;
});

const messageKey = computed(() => {
	return props.isAnotherTab
		? 'collaboration.canvas.editingAnotherTab'
		: 'collaboration.canvas.editing';
});

const message = computed(() => {
	return props.isAnotherTab ? t(messageKey.value) : t(messageKey.value, { user: userName.value });
});
</script>

<template>
	<N8nCanvasPill>
		<template #icon>
			<N8nAvatar v-if="!isAnotherTab" :first-name="firstName" :last-name="lastName" size="small" />
		</template>
		{{ message }}
	</N8nCanvasPill>
</template>
