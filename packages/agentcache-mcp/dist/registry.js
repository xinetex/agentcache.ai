export class ToolRegistry {
    tools = [];
    handlers = new Map();
    registerModule(module) {
        this.tools.push(...module.tools);
        for (const [name, handler] of Object.entries(module.handlers)) {
            if (this.handlers.has(name)) {
                throw new Error(`Tool ${name} is already registered`);
            }
            this.handlers.set(name, handler);
        }
    }
    getTools() {
        return this.tools;
    }
    getHandler(name) {
        return this.handlers.get(name);
    }
}
