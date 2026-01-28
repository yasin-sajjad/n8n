/**
 * Prompt definitions for script execution tool.
 *
 * These prompts are injected into the builder agent's system prompt when
 * script execution is enabled, providing guidance on when and how to use
 * the execute_script tool effectively.
 */

import { TOOL_INTERFACE_DEFINITIONS } from '../../tools/script-execution/tool-interfaces';

/**
 * When to use execute_script vs individual tools
 */
export const SCRIPT_EXECUTION_WHEN_TO_USE = `## When to Use execute_script

ALWAYS use execute_script for building workflows. Call it multiple times, building incrementally.

### Iterative Building (RECOMMENDED)
Build workflows incrementally by calling execute_script multiple times:
1. Each call adds a small group of related nodes (1-3 nodes)
2. Connect them to previously created nodes (reference by name)
3. Configure them immediately
4. Repeat for the next group

Benefits:
- Faster generation per step (smaller scripts are simpler)
- User sees progress incrementally
- Better error recovery (previous nodes already exist)

### Node Groups (create related nodes together)
Some nodes are semantically related and should be created in ONE script:
- **AI Agent group**: AI Agent + Chat Model (+ optional Memory, Tools)
- **Vector Store group**: Vector Store + Embeddings (+ optional Document Loader)
- **Approval group**: Slack/Email sendAndWait + related Set nodes
- **Switch/If group**: Switch/If node + its immediate downstream branches`;

/**
 * Script execution best practices
 */
export const SCRIPT_EXECUTION_BEST_PRACTICES = `## Script Best Practices

1. **Use SHORT-FORM syntax** - Use \`t:\` instead of \`nodeType:\`, \`s:\` instead of \`sourceNodeId:\`
2. **CRITICAL: Configure ALL nodes** - Every node MUST have its parameters fully configured using tools.updateNodeParameters()
3. **Use tools.updateNodeParameters() for configuration** - This is the PRIMARY method for configuring nodes
4. **Use batch methods** - \`tools.add()\`, \`tools.conn()\`, \`tools.updateAll()\` for efficiency
5. **AWAIT RULES** - Only \`updateNodeParameters()\` and \`updateAll()\` need await (they use LLM). All other tools are synchronous.
6. **CRITICAL: Multi-output/input nodes** - Switch nodes need \`so:\` (output index), Merge nodes need \`di:\` (input index)

MANDATORY: After creating nodes and connections, you MUST configure each node using tools.updateNodeParameters() or tools.updateAll().
Describe what each node should do in natural language - the system will figure out the exact parameters.

COMPLETE pattern (nodes + connections + FULL configuration via updateAll):
\`\`\`javascript
// SYNCHRONOUS: add() and conn() don't need await
const r = tools.add({{nodes:[
  {{t:'n8n-nodes-base.webhook',n:'Webhook',p:{{httpMethod:'POST',path:'purchase-request'}}}},
  {{t:'n8n-nodes-base.set',n:'Extract Data'}},
  {{t:'n8n-nodes-base.slack',n:'Request Approval'}},
  {{t:'n8n-nodes-base.emailSend',n:'Send Confirmation'}}
]}});
const [wh,extract,slack,email] = r.results;
tools.conn({{connections:[{{s:wh,d:extract}},{{s:extract,d:slack}},{{s:slack,d:email}}]}});

// ASYNC: updateAll() uses LLM so it needs await - describe what each node should do
await tools.updateAll({{updates:[
  {{nodeId:extract.nodeId,changes:[
    "Add field 'requester' with value from {{$json.body.requester}}",
    "Add field 'amount' as number from {{$json.body.amount}}",
    "Add field 'description' from {{$json.body.description}}",
    "Add field 'email' from {{$json.body.email}}"
  ]}},
  {{nodeId:slack.nodeId,changes:[
    "Set operation to sendAndWait for approval",
    "Set message to show approval request with requester name {{$json.requester}}, amount \${{$json.amount}}, and description {{$json.description}}",
    "Configure approval buttons with Approve and Reject options"
  ]}},
  {{nodeId:email.nodeId,changes:[
    "Set fromEmail to approvals@company.com",
    "Set toEmail to {{$json.email}}",
    "Set subject to 'Purchase Request Decision - \${{$json.amount}}'",
    "Set HTML body with decision details including amount, description, and approval status"
  ]}}
]}});
\`\`\``;

/**
 * Configuration tools for parameter updates
 */
export const CONFIGURATOR_SCRIPT_TOOLS = `## Configuration Tools

CRITICAL: Every node MUST be configured. Use tools.updateNodeParameters() or tools.updateAll() to configure nodes.

### tools.updateNodeParameters({{ nodeId, changes }}) - PRIMARY Configuration Method (ASYNC - requires await)
Describe what the node should do in natural language. The system figures out the exact parameters.
\`\`\`javascript
await tools.updateNodeParameters({{nodeId:slack.nodeId,changes:[
  "Set operation to sendAndWait for approval workflow",
  "Set message to show requester {{$json.requester}}, amount \${{$json.amount}}, and description",
  "Configure approval buttons with Approve and Reject options",
  "Format message with emoji and markdown for readability"
]}});
\`\`\`

### tools.updateAll({{ updates }}) - Batch Configuration (RECOMMENDED, ASYNC - requires await)
Configure multiple nodes at once. Use this after creating all nodes and connections.
\`\`\`javascript
await tools.updateAll({{updates:[
  {{nodeId:setNode.nodeId,changes:[
    "Add field 'requester' from {{$json.body.requester}}",
    "Add field 'amount' as number from {{$json.body.amount}}",
    "Add field 'description' from {{$json.body.description}}"
  ]}},
  {{nodeId:slack.nodeId,changes:[
    "Set operation to sendAndWait",
    "Set message showing approval request with requester, amount, description",
    "Add approval buttons for Approve and Reject"
  ]}},
  {{nodeId:email.nodeId,changes:[
    "Set fromEmail to notifications@company.com",
    "Set toEmail to {{$json.requesterEmail}}",
    "Set subject to 'Request Decision - \${{$json.amount}}'",
    "Set HTML body with formatted decision details"
  ]}}
]}});
\`\`\`

### tools.set({{ nodeId, params }}) - Direct Setting (SYNCHRONOUS - no await needed)
Only use when you know the EXACT parameter structure. For most nodes, use updateNodeParameters instead.
\`\`\`javascript
// Only for simple, well-known structures like AI Agent (no await needed)
tools.set({{nodeId:agent,params:{{
  systemMessage:'You are a helpful assistant.',
  prompt:'={{$json.input}}'
}}}});
\`\`\`

### When to use which method:

**ALWAYS use tools.updateAll() for:** (requires await)
- Slack nodes (messages, channels, approval options)
- Email nodes (recipients, subjects, HTML content)
- Set/Edit Fields nodes (field assignments)
- HTTP Request nodes (URLs, methods, headers, body)
- Any node with complex configuration

**Only use tools.set() for:** (no await needed)
- AI Agent systemMessage and prompt (simple string params)
- Merge node mode setting
- Simple boolean or string parameters you're certain about

REMEMBER: When in doubt, use updateNodeParameters/updateAll. Unconfigured nodes are NEVER acceptable.
`;

/**
 * Iterative building patterns - call execute_script multiple times
 * IMPORTANT: add() and conn() are SYNCHRONOUS (no await). Only updateAll() needs await.
 */
export const SCRIPT_EXECUTION_PATTERNS = `## Iterative Building Patterns (RECOMMENDED)

Build workflows incrementally by calling execute_script multiple times. Each call adds a small group of related nodes.

### Iteration 1: Trigger Node
First script - create the trigger and configure it:
\`\`\`javascript
const webhook = tools.addNode({{t:'n8n-nodes-base.webhook',n:'Purchase Request',p:{{httpMethod:'POST',path:'purchase-request'}}}});
await tools.updateNodeParameters({{nodeId:webhook.nodeId,changes:[
  "Set path to 'purchase-request'",
  "Set HTTP method to POST",
  "Set response mode to lastNode"
]}});
\`\`\`

### Iteration 2: Config/Set Node
Second script - add config node, connect to trigger (by name), configure:
\`\`\`javascript
const config = tools.addNode({{t:'n8n-nodes-base.set',n:'Workflow Configuration'}});
tools.connectNodes({{s:'Purchase Request',d:config}});  // Reference trigger by name
await tools.updateNodeParameters({{nodeId:config.nodeId,changes:[
  "Add field 'requester' from {{$json.body.requester}}",
  "Add field 'amount' as number from {{$json.body.amount}}",
  "Add field 'description' from {{$json.body.description}}"
]}});
\`\`\`

### Iteration 3: AI Agent Group (related nodes together)
Create related nodes in one script - AI Agent needs its Chat Model:
\`\`\`javascript
const r = tools.add({{nodes:[
  {{t:'@n8n/n8n-nodes-langchain.agent',n:'Agent',p:{{hasOutputParser:false}}}},
  {{t:'@n8n/n8n-nodes-langchain.lmChatOpenAi',n:'Model'}}
]}});
const [agent,model] = r.results;
tools.conn({{connections:[
  {{s:'Workflow Configuration',d:agent}},  // Connect to previous node by name
  {{s:model,d:agent}}                        // Connect model to agent
]}});
tools.set({{nodeId:agent,params:{{
  systemMessage:'You are a helpful assistant.',
  prompt:'={{$json.input}}'
}}}});
\`\`\`

### Iteration 4: Switch Group (router + branches)
Create switch and its immediate branches together:
\`\`\`javascript
const r = tools.add({{nodes:[
  {{t:'n8n-nodes-base.switch',n:'Route by Amount'}},
  {{t:'n8n-nodes-base.set',n:'Handle Low'}},
  {{t:'n8n-nodes-base.set',n:'Handle High'}}
]}});
const [sw,low,high] = r.results;
tools.conn({{connections:[
  {{s:'Workflow Configuration',d:sw}},  // Connect to previous node
  {{s:sw,d:low,so:0}},                   // First output
  {{s:sw,d:high,so:1}}                   // Second output
]}});
await tools.updateAll({{updates:[
  {{nodeId:sw.nodeId,changes:["Add 2 rules based on {{$json.amount}}: under 100 → first output, 100 or more → second output"]}},
  {{nodeId:low.nodeId,changes:["Add field 'tier' with value 'standard'"]}},
  {{nodeId:high.nodeId,changes:["Add field 'tier' with value 'priority'"]}}
]}});
\`\`\`

### Iteration 5: Final nodes (converging paths)
Add merge and final processing:
\`\`\`javascript
const r = tools.add({{nodes:[
  {{t:'n8n-nodes-base.merge',n:'Merge Results',p:{{mode:'append',numberInputs:2}}}},
  {{t:'n8n-nodes-base.emailSend',n:'Send Notification'}}
]}});
const [merge,email] = r.results;
tools.conn({{connections:[
  {{s:'Handle Low',d:merge,di:0}},   // Connect branches to merge
  {{s:'Handle High',d:merge,di:1}},
  {{s:merge,d:email}}
]}});
await tools.updateNodeParameters({{nodeId:email.nodeId,changes:[
  "Set toEmail to {{$json.requesterEmail}}",
  "Set subject to 'Request Processed'",
  "Set HTML body with processing details"
]}});
\`\`\`

## Node Group Reference

Create these related nodes TOGETHER in one script:

| Group | Nodes to create together |
|-------|-------------------------|
| AI Agent | Agent + Chat Model (+ Memory, Tools if needed) |
| Vector Store | Vector Store + Embeddings (+ Document Loader) |
| Switch/If | Switch/If + immediate branch nodes |
| Approval | Slack/Email sendAndWait + response handling Set nodes |
| RAG Query | Q&A Chain + Retriever + Chat Model |`;

/**
 * TypeScript interface definitions for the script context
 */
export const SCRIPT_TYPE_DEFINITIONS = `## Script Type Definitions

${TOOL_INTERFACE_DEFINITIONS}`;

/**
 * Full script execution guidance block for builder prompt
 */
export function buildScriptExecutionGuidance(): string {
	return [
		SCRIPT_EXECUTION_WHEN_TO_USE,
		SCRIPT_EXECUTION_BEST_PRACTICES,
		SCRIPT_EXECUTION_PATTERNS,
		CONFIGURATOR_SCRIPT_TOOLS,
	].join('\n\n');
}

/**
 * Condensed guidance for space-constrained prompts
 */
export const SCRIPT_EXECUTION_CONDENSED = `## CRITICAL: Iterative Script-Based Workflow Building

You MUST call the execute_script tool to build workflows. Build ITERATIVELY by calling it multiple times.

### ITERATIVE BUILDING (RECOMMENDED)
Call execute_script multiple times, each adding a small group of related nodes:
1. **First call**: Create trigger node, configure it
2. **Next calls**: Add 1-3 related nodes, connect to previous nodes BY NAME, configure them
3. **Repeat** until workflow is complete

Benefits: Faster generation, incremental progress, better error recovery.

### NODE GROUPS (create related nodes together)
- **AI Agent**: Agent + Chat Model (+ Memory/Tools if needed)
- **Vector Store**: Vector Store + Embeddings (+ Document Loader)
- **Switch/If**: Router + its immediate branch nodes
- **Approval**: sendAndWait node + response handling

### EXAMPLE - Iterative Building (3 script calls)

**Script 1: Trigger**
\`\`\`javascript
const wh = tools.addNode({{t:'n8n-nodes-base.webhook',n:'Webhook',p:{{httpMethod:'POST',path:'request'}}}});
await tools.updateNodeParameters({{nodeId:wh.nodeId,changes:["Set response mode to lastNode"]}});
\`\`\`

**Script 2: Processing (references trigger by name)**
\`\`\`javascript
const extract = tools.addNode({{t:'n8n-nodes-base.set',n:'Extract Data'}});
tools.connectNodes({{s:'Webhook',d:extract}});  // Reference by name!
await tools.updateNodeParameters({{nodeId:extract.nodeId,changes:[
  "Add field 'requester' from {{$json.body.requester}}",
  "Add field 'amount' from {{$json.body.amount}}"
]}});
\`\`\`

**Script 3: AI Agent Group (related nodes together)**
\`\`\`javascript
const r = tools.add({{nodes:[
  {{t:'@n8n/n8n-nodes-langchain.agent',n:'Agent'}},
  {{t:'@n8n/n8n-nodes-langchain.lmChatOpenAi',n:'Model'}}
]}});
const [agent,model] = r.results;
tools.conn({{connections:[{{s:'Extract Data',d:agent}},{{s:model,d:agent}}]}});
tools.set({{nodeId:agent,params:{{systemMessage:'You are helpful.',prompt:'={{$json.input}}'}}}});
\`\`\`

### AWAIT RULES
- **SYNC (no await)**: tools.add(), tools.addNode(), tools.conn(), tools.connectNodes(), tools.set(), tools.setAll()
- **ASYNC (requires await)**: tools.updateAll(), tools.updateNodeParameters()

### SHORT-FORM SYNTAX
- Node: {{t:'nodeType',n:'Name',p:{{params}}}}
- Connection: {{s:source,d:dest,so:outputIndex,di:inputIndex}}
- Reference previous nodes BY NAME: {{s:'Node Name',d:newNode}}

### MULTI-OUTPUT/INPUT NODES
- Switch: use 'so' for output index: {{s:switchNode,d:target,so:1}}
- Merge: use 'di' for input index: {{s:source,d:mergeNode,di:1}}

### KEY RULES
1. Build ITERATIVELY - multiple small scripts, not one giant script
2. Group related nodes together (AI Agent + Model, Switch + branches)
3. Reference previous nodes BY NAME in connections
4. ALWAYS configure nodes with updateNodeParameters() or set()
5. Only await updateAll()/updateNodeParameters() - other tools are sync`;
