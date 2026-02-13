import { ref } from 'vue';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestNode } from '@/__tests__/mocks';
import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import TriggerExecuteButton from './TriggerExecuteButton.vue';
import type { INodeUi } from '@/Interface';

const mockExecute = vi.fn().mockResolvedValue('executed');
const mockButtonLabel = ref('Test step');
const mockButtonIcon = ref('flask-conical');
const mockIsExecuting = ref(false);
const mockDisabledReason = ref('');
const mockHasIssues = ref(false);

vi.mock('@/app/composables/useNodeExecution', () => ({
	useNodeExecution: () => ({
		execute: mockExecute,
		buttonLabel: mockButtonLabel,
		buttonIcon: mockButtonIcon,
		isExecuting: mockIsExecuting,
		disabledReason: mockDisabledReason,
		hasIssues: mockHasIssues,
	}),
}));

vi.mock('@/app/components/NodeIcon.vue', () => ({
	default: {
		template: '<div data-test-id="node-icon"></div>',
		props: ['nodeType', 'size'],
	},
}));

const renderComponent = createComponentRenderer(TriggerExecuteButton);

const createNode = (overrides: Partial<INodeUi> = {}): INodeUi =>
	createTestNode({
		name: 'SlackTrigger',
		type: 'n8n-nodes-base.slackTrigger',
		typeVersion: 1,
		position: [0, 0],
		...overrides,
	}) as INodeUi;

describe('TriggerExecuteButton', () => {
	beforeEach(() => {
		createTestingPinia();
		mockExecute.mockReset().mockResolvedValue('executed');
		mockIsExecuting.value = false;
		mockDisabledReason.value = '';
		mockHasIssues.value = false;
		mockButtonLabel.value = 'Test step';
		mockButtonIcon.value = 'flask-conical';
	});

	describe('single trigger', () => {
		it('should render the execute button', () => {
			const { getByTestId } = renderComponent({
				props: { nodes: [createNode()] },
			});

			expect(getByTestId('trigger-execute-btn')).toBeInTheDocument();
		});

		it('should not render dropdown for single trigger', () => {
			const { queryByTestId } = renderComponent({
				props: { nodes: [createNode()] },
			});

			expect(queryByTestId('trigger-execute-dropdown')).not.toBeInTheDocument();
		});

		it('should call execute and emit executed on click', async () => {
			const { getByTestId, emitted } = renderComponent({
				props: { nodes: [createNode()] },
			});

			await userEvent.click(getByTestId('trigger-execute-btn'));

			expect(mockExecute).toHaveBeenCalledTimes(1);
			expect(emitted('executed')).toHaveLength(1);
		});

		it('should be disabled when hasIssues is true', () => {
			mockHasIssues.value = true;

			const { getByTestId } = renderComponent({
				props: { nodes: [createNode()] },
			});

			expect(getByTestId('trigger-execute-btn')).toBeDisabled();
		});

		it('should be disabled when isExecuting is true', () => {
			mockIsExecuting.value = true;

			const { getByTestId } = renderComponent({
				props: { nodes: [createNode()] },
			});

			expect(getByTestId('trigger-execute-btn')).toBeDisabled();
		});

		it('should be disabled when disabledReason is set', () => {
			mockDisabledReason.value = 'Workflow is running';

			const { getByTestId } = renderComponent({
				props: { nodes: [createNode()] },
			});

			expect(getByTestId('trigger-execute-btn')).toBeDisabled();
		});
	});

	describe('multiple triggers', () => {
		it('should render dropdown when multiple triggers provided', () => {
			const trigger1 = createNode({ name: 'Trigger1' });
			const trigger2 = createNode({ name: 'Trigger2' });

			const { getByTestId } = renderComponent({
				props: { nodes: [trigger1, trigger2] },
			});

			expect(getByTestId('trigger-execute-btn')).toBeInTheDocument();
			expect(getByTestId('trigger-execute-dropdown')).toBeInTheDocument();
		});

		it('should apply split button styling', () => {
			const trigger1 = createNode({ name: 'Trigger1' });
			const trigger2 = createNode({ name: 'Trigger2' });

			const { getByTestId } = renderComponent({
				props: { nodes: [trigger1, trigger2] },
			});

			expect(getByTestId('trigger-execute-button').className).toMatch(/split/);
		});
	});
});
