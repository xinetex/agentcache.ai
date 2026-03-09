import { LLMFactory } from '../lib/llm/factory.js';

import { LLMProvider } from '../lib/llm/types.js';

export class OntologyService {
    private llm: LLMProvider;

    constructor(llm?: LLMProvider) {
        // Dependency Injection: Allow custom LLM to be injected (e.g. for testing)
        // Defaults to Inception for high-speed mapping performance
        this.llm = llm || LLMFactory.createProvider('inception');
    }

    /**
     * Map unstructured or multi-domain data into a strict JSON ontology.
     * Uses Inception Labs for high-speed, structured output enforcement.
     * 
     * @param sourceData Raw data string or mixed object to parse.
     * @param targetSchema Must be a valid JSON schema representing the domain ontology.
     * @returns A strictly formatted JSON object matching the targetSchema.
     */
    async semanticMap(sourceData: string | object, targetSchema: object): Promise<any> {
        console.log(`[OntologyService] Initiating high-speed map via Inception...`);

        const strData = typeof sourceData === 'string' ? sourceData : JSON.stringify(sourceData);

        const prompt = `
You are a strict Data Ontology Mapper.
Your single objective is to extract information from the following SOURCE DATA and map it EXACTLY to the structure defined in the TARGET ONTOLOGY SCHEMA.

<SOURCE_DATA>
${strData}
</SOURCE_DATA>

<TARGET_ONTOLOGY_SCHEMA>
${JSON.stringify(targetSchema, null, 2)}
</TARGET_ONTOLOGY_SCHEMA>

Rules:
1. ONLY return valid JSON that conforms to the target schema.
2. DO NOT include markdown formatting or explanations.
3. If data is missing for a required field, infer a reasonable default or use null based on schema definition.
`;

        try {
            // Because Inception Labs is uniquely tuned for code/structure, we pass this directly.
            const response = await this.llm.chat([
                { role: 'system', content: 'You are a machine-to-machine ontology mapper. Return ONLY JSON.' },
                { role: 'user', content: prompt }
            ], {
                // temperature is handled by the Inception provider defaults (0.1)
                model: 'inception-base'
            });

            // Parse result
            const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("No JSON found in LLM response");
            }

            return JSON.parse(jsonMatch[0]);

        } catch (error: any) {
            console.error(`[OntologyService] Mapping failed: ${error.message}`);
            throw new Error(`Ontology Mapping Error: ${error.message}`);
        }
    }
}

export const ontologyService = new OntologyService();
