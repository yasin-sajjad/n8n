import { createComponentRenderer } from '@/__tests__/render';
import { createTestNode, mockNodeTypeDescription } from '@/__tests__/mocks';
import { mockedStore } from '@/__tests__/utils';
import { createTestingPinia } from '@pinia/testing';
import { waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import TriggerSetupCard from './TriggerSetupCard.vue';
import type { TriggerSetupState } from '../setupPanel.types';
import type { INodeUi } from '@/Interface';

const { mockExecute, mockComposableState } = vi.hoisted(() => ({
	mockExecute: vi.fn(),
	mockComposableState: {
		isExecuting: false,
		isListening: false,
		isListeningForWorkflowEvents: false,
		hasIssues: false,
		disabledReason: '',
	},
}));

vi.mock('@/app/composables/useNodeExecution', async () => {
	const { ref, computed } = await import('vue');
	return {
		useNodeExecution: vi.fn(() => ({
			isExecuting: computed(() => mockComposableState.isExecuting),
			isListening: computed(() => mockComposableState.isListening),
			isListeningForWorkflowEvents: computed(
				() => mockComposableState.isListeningForWorkflowEvents,
			),
			buttonLabel: ref('Test node'),
			buttonIcon: ref('flask-conical'),
			disabledReason: computed(() => mockComposableState.disabledReason),
			isTriggerNode: ref(false),
			hasIssues: computed(() => mockComposableState.hasIssues),
			shouldGenerateCode: ref(false),
			execute: mockExecute,
			stopExecution: vi.fn(),
		})),
	};
});

const renderComponent = createComponentRenderer(TriggerSetupCard);

const createState = (overrides: Partial<TriggerSetupState> = {}): TriggerSetupState => {
	const node = createTestNode({
		name: 'Webhook Trigger',
		type: 'n8n-nodes-base.webhook',
		typeVersion: 1,
	}) as INodeUi;

	return {
		node,
		isComplete: false,
		...overrides,
	};
};

describe('TriggerSetupCard', () => {
	let nodeTypesStore: ReturnType<typeof mockedStore<typeof useNodeTypesStore>>;

	beforeEach(() => {
		mockExecute.mockClear();
		mockComposableState.isExecuting = false;
		mockComposableState.isListening = false;
		mockComposableState.isListeningForWorkflowEvents = false;
		mockComposableState.hasIssues = false;
		mockComposableState.disabledReason = '';
		createTestingPinia();
		nodeTypesStore = mockedStore(useNodeTypesStore);
		nodeTypesStore.getNodeType = vi.fn().mockReturnValue(
			mockNodeTypeDescription({
				name: 'n8n-nodes-base.webhook',
				displayName: 'Webhook Trigger',
			}),
		);
	});

	describe('rendering', () => {
		it('should render node name in header', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-setup-card-header')).toHaveTextContent('Webhook Trigger');
		});

		it('should render test button when expanded', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-execute-button')).toBeInTheDocument();
		});

		it('should not render content when collapsed', () => {
			const { queryByTestId } = renderComponent({
				props: { state: createState(), expanded: false },
			});

			expect(queryByTestId('trigger-execute-button')).not.toBeInTheDocument();
		});
	});

	describe('expand/collapse', () => {
		it('should toggle expanded state when header is clicked', async () => {
			const { getByTestId, emitted } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			await userEvent.click(getByTestId('trigger-setup-card-header'));

			expect(emitted('update:expanded')).toEqual([[false]]);
		});

		it('should emit expand when clicking collapsed card header', async () => {
			const { getByTestId, emitted } = renderComponent({
				props: { state: createState(), expanded: false },
			});

			await userEvent.click(getByTestId('trigger-setup-card-header'));

			expect(emitted('update:expanded')).toEqual([[true]]);
		});

		it('should auto-collapse when isComplete changes to true', async () => {
			const state = createState({ isComplete: false });
			const { emitted, rerender } = renderComponent({
				props: { state, expanded: true },
			});

			await rerender({ state: { ...state, isComplete: true }, expanded: true });

			await waitFor(() => {
				expect(emitted('update:expanded')).toEqual([[false]]);
			});
		});

		it('should start collapsed when mounted with isComplete true', () => {
			const { emitted } = renderComponent({
				props: { state: createState({ isComplete: true }), expanded: true },
			});

			expect(emitted('update:expanded')).toEqual([[false]]);
		});
	});

	describe('complete state', () => {
		it('should show check icon in header when collapsed and complete', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState({ isComplete: true }), expanded: false },
			});

			expect(getByTestId('trigger-setup-card-complete-icon')).toBeInTheDocument();
		});

		it('should apply completed class when isComplete is true', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState({ isComplete: true }), expanded: false },
			});

			expect(getByTestId('trigger-setup-card').className).toMatch(/completed/);
		});

		it('should not apply completed class when isComplete is false', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState({ isComplete: false }), expanded: false },
			});

			expect(getByTestId('trigger-setup-card').className).not.toMatch(/completed/);
		});
	});

	describe('test button', () => {
		it('should render test button when expanded', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-execute-button')).toBeInTheDocument();
		});

		it('should disable test button when node has issues', () => {
			mockComposableState.hasIssues = true;

			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-execute-button')).toBeDisabled();
		});

		it('should disable test button when node is executing', () => {
			mockComposableState.isExecuting = true;

			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-execute-button')).toBeDisabled();
		});

		it('should enable test button when node has no issues and is not executing', () => {
			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			expect(getByTestId('trigger-execute-button')).not.toBeDisabled();
		});
	});

	describe('test execution', () => {
		it('should call execute when test button is clicked', async () => {
			const { getByTestId } = renderComponent({
				props: { state: createState(), expanded: true },
			});

			await userEvent.click(getByTestId('trigger-execute-button'));

			expect(mockExecute).toHaveBeenCalledTimes(1);
		});
	});
});
