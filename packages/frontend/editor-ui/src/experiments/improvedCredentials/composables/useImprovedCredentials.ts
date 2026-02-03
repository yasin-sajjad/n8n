import { computed } from 'vue';
import { useImprovedCredentialsStore } from '../stores/improvedCredentials.store';

export function useImprovedCredentials() {
	const store = useImprovedCredentialsStore();

	const isEnabled = computed(() => store.isFeatureEnabled);

	return {
		isEnabled,
	};
}
