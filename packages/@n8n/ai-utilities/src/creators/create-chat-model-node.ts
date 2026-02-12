import type { INodeType, ISupplyDataFunctions } from 'n8n-workflow';
import { supplyModel } from 'src/suppliers/supplyModel';
import type { ChatModelNodeConfig, UnextendableNodeType } from 'src/types/creators';

export const createChatModelNode = (chatModelNode: ChatModelNodeConfig) => {
	const constructor = class ChatModelNode implements INodeType {
		description = chatModelNode.description;
		methods = chatModelNode.methods;
		async supplyData(this: ISupplyDataFunctions, itemIndex: number) {
			const model =
				typeof chatModelNode.getModel === 'function'
					? await chatModelNode.getModel(this, itemIndex)
					: chatModelNode.getModel;
			return supplyModel(this, model);
		}
	};
	return constructor as UnextendableNodeType;
};
