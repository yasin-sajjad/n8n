import { NodeOperationError, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';

import * as agentUser from './agentUser';
import * as application from './application';
import * as blueprint from './blueprint';
import * as identity from './identity';
import type { MicrosoftAgent365Type } from './node.type';

export async function router(this: IExecuteFunctions) {
	const returnData: INodeExecutionData[] = [];

	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0);
	const operation = this.getNodeParameter('operation', 0);

	const microsoftAgent365TypeData = {
		resource,
		operation,
	} as MicrosoftAgent365Type;

	let execute;
	switch (microsoftAgent365TypeData.resource) {
		case 'agentUser':
			execute = agentUser[microsoftAgent365TypeData.operation].execute;
			break;

		case 'application':
			execute = application[microsoftAgent365TypeData.operation].execute;
			break;

		case 'blueprint':
			execute = blueprint[microsoftAgent365TypeData.operation].execute;
			break;

		case 'identity':
			execute = identity[microsoftAgent365TypeData.operation].execute;
			break;

		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported!`,
			);
	}

	for (let i = 0; i < items.length; i++) {
		try {
			const responseData = await execute.call(this, i);
			returnData.push(...responseData);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
				continue;
			}

			throw new NodeOperationError(this.getNode(), error, {
				itemIndex: i,
				description: error.description,
			});
		}
	}

	return [returnData];
}
