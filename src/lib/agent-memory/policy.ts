/**
 * Policy Engine - Access control and governance for agent memory
 * 
 * Enforces: read/write permissions, retention policies, sharing rules
 */

export interface MemoryPolicy {
  id: string;
  name: string;
  rules: PolicyRule[];
  priority: number;
}

export interface PolicyRule {
  action: 'allow' | 'deny';
  operation: 'read' | 'write' | 'delete' | 'share' | '*';
  conditions: PolicyCondition[];
}

export interface PolicyCondition {
  field: 'namespace' | 'key' | 'agent' | 'tier' | 'size' | 'age';
  operator: 'equals' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'in';
  value: any;
}

export class PolicyEngine {
  private policies: MemoryPolicy[] = [];
  private defaultAllow = true;

  constructor() {
    this.loadDefaultPolicies();
  }

  private loadDefaultPolicies(): void {
    // Default policies
    this.policies = [
      {
        id: 'system-protection',
        name: 'Protect system namespaces',
        priority: 100,
        rules: [
          {
            action: 'deny',
            operation: 'delete',
            conditions: [
              { field: 'namespace', operator: 'startsWith', value: 'system:' },
            ],
          },
        ],
      },
      {
        id: 'agent-isolation',
        name: 'Agent namespace isolation',
        priority: 50,
        rules: [
          {
            action: 'deny',
            operation: '*',
            conditions: [
              { field: 'namespace', operator: 'startsWith', value: 'agent:' },
              // Agent can only access their own namespace (checked dynamically)
            ],
          },
        ],
      },
      {
        id: 'size-limits',
        name: 'Enforce size limits',
        priority: 30,
        rules: [
          {
            action: 'deny',
            operation: 'write',
            conditions: [
              { field: 'size', operator: 'gt', value: 100 * 1024 * 1024 }, // 100MB max
            ],
          },
        ],
      },
    ];
  }

  /**
   * Check if write operation is allowed
   */
  async checkWrite(agentId: string, key: string, options: any): Promise<boolean> {
    const context = {
      agentId,
      key,
      operation: 'write' as const,
      namespace: options.namespace || `agent:${agentId}`,
      size: options.size || 0,
    };

    return this.evaluate(context);
  }

  /**
   * Check if read operation is allowed
   */
  async checkRead(agentId: string, query: string, options: any): Promise<boolean> {
    const context = {
      agentId,
      key: query,
      operation: 'read' as const,
      namespace: options.namespace || `agent:${agentId}`,
    };

    return this.evaluate(context);
  }

  /**
   * Check if delete operation is allowed
   */
  async checkDelete(agentId: string, key: string, options: any): Promise<boolean> {
    const context = {
      agentId,
      key,
      operation: 'delete' as const,
      namespace: this.extractNamespace(key),
    };

    return this.evaluate(context);
  }

  /**
   * Check if share operation is allowed
   */
  async checkShare(
    sourceAgentId: string,
    targetAgentId: string,
    key: string,
    options: any
  ): Promise<boolean> {
    const context = {
      agentId: sourceAgentId,
      targetAgentId,
      key,
      operation: 'share' as const,
      namespace: this.extractNamespace(key),
    };

    return this.evaluate(context);
  }

  /**
   * Evaluate policies against context
   */
  private evaluate(context: Record<string, any>): boolean {
    // Sort policies by priority (higher first)
    const sortedPolicies = [...this.policies].sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      for (const rule of policy.rules) {
        if (this.matchesOperation(rule.operation, context.operation)) {
          if (this.matchesConditions(rule.conditions, context)) {
            // Special case: agent isolation
            if (policy.id === 'agent-isolation') {
              const expectedNamespace = `agent:${context.agentId}`;
              if (!context.namespace?.startsWith(expectedNamespace)) {
                if (rule.action === 'deny') {
                  console.log(`[Policy] Denied by ${policy.name}: agent isolation violation`);
                  return false;
                }
              }
              // Agent accessing their own namespace is allowed
              continue;
            }

            if (rule.action === 'deny') {
              console.log(`[Policy] Denied by ${policy.name}`);
              return false;
            }
            if (rule.action === 'allow') {
              return true;
            }
          }
        }
      }
    }

    return this.defaultAllow;
  }

  private matchesOperation(ruleOp: string, contextOp: string): boolean {
    return ruleOp === '*' || ruleOp === contextOp;
  }

  private matchesConditions(conditions: PolicyCondition[], context: Record<string, any>): boolean {
    for (const condition of conditions) {
      const contextValue = context[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          if (contextValue !== condition.value) return false;
          break;
        case 'contains':
          if (!String(contextValue).includes(condition.value)) return false;
          break;
        case 'startsWith':
          if (!String(contextValue).startsWith(condition.value)) return false;
          break;
        case 'gt':
          if (!(contextValue > condition.value)) return false;
          break;
        case 'lt':
          if (!(contextValue < condition.value)) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(contextValue)) return false;
          break;
      }
    }

    return true;
  }

  private extractNamespace(key: string): string {
    // Extract namespace from key format "namespace:rest:of:key"
    const parts = key.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return parts[0];
  }

  /**
   * Add a custom policy
   */
  addPolicy(policy: MemoryPolicy): void {
    this.policies.push(policy);
  }

  /**
   * Remove a policy by ID
   */
  removePolicy(policyId: string): void {
    this.policies = this.policies.filter(p => p.id !== policyId);
  }

  /**
   * Get all policies
   */
  getPolicies(): MemoryPolicy[] {
    return [...this.policies];
  }
}

export default PolicyEngine;
