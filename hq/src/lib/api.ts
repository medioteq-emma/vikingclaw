const BASE_URL = 'http://localhost:7070';

export const api = {
  async getStatus() {
    const r = await fetch(`${BASE_URL}/api/status`);
    return r.json();
  },
  async getModels() {
    const r = await fetch(`${BASE_URL}/api/models`);
    return r.json();
  },
  async getMemory() {
    const r = await fetch(`${BASE_URL}/api/memory`);
    return r.json();
  },
  async searchMemory(query: string) {
    const r = await fetch(`${BASE_URL}/api/memory/search?q=${encodeURIComponent(query)}`);
    return r.json();
  },
  async getAudit() {
    const r = await fetch(`${BASE_URL}/api/security/audit`);
    return r.json();
  },
  async getBudget() {
    const r = await fetch(`${BASE_URL}/api/budget`);
    return r.json();
  },
  async getAgents() {
    const r = await fetch(`${BASE_URL}/api/agents`);
    return r.json();
  },
  async getCron() {
    const r = await fetch(`${BASE_URL}/api/cron`);
    return r.json();
  },
  // Browser
  async getBrowserStatus() {
    const r = await fetch(`${BASE_URL}/api/browser/status`);
    return r.json();
  },
  async browserNavigate(url: string) {
    const r = await fetch(`${BASE_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return r.json();
  },
  async browserScreenshot() {
    const r = await fetch(`${BASE_URL}/api/browser/screenshot`);
    return r.json();
  },
  async browserExecute(script: string) {
    const r = await fetch(`${BASE_URL}/api/browser/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });
    return r.json();
  },
  async browserStop() {
    const r = await fetch(`${BASE_URL}/api/browser/stop`, { method: 'POST' });
    return r.json();
  },
  // Automation
  async getAutomationRules() {
    const r = await fetch(`${BASE_URL}/api/automation/rules`);
    return r.json();
  },
  async getAutomationRuns() {
    const r = await fetch(`${BASE_URL}/api/automation/runs`);
    return r.json();
  },
  async addAutomationRule(rule: object) {
    const r = await fetch(`${BASE_URL}/api/automation/rule/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return r.json();
  },
  async toggleAutomationRule(id: string) {
    const r = await fetch(`${BASE_URL}/api/automation/rule/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return r.json();
  },
  async deleteAutomationRule(id: string) {
    const r = await fetch(`${BASE_URL}/api/automation/rule/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return r.json();
  },
  async runAutomationRule(id: string) {
    const r = await fetch(`${BASE_URL}/api/automation/rule/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return r.json();
  },
  // Tools
  async getTools() {
    const r = await fetch(`${BASE_URL}/api/tools/list`);
    return r.json();
  },
  async getToolsList() {
    // alias
    return this.getTools();
  },
  async executeTool(tool: string, params: Record<string, string>) {
    const r = await fetch(`${BASE_URL}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params }),
    });
    return r.json();
  },
  async executeTools(tool: string, params: Record<string, string>) {
    // alias for backward compat
    return this.executeTool(tool, params);
  },
  // Chat
  async chat(message: string, sessionId?: string) {
    const r = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    return r.json();
  },
  // Models pull (non-streaming legacy)
  async pullModel(model: string) {
    const r = await fetch(`${BASE_URL}/api/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    return r.json();
  },
  // Models extended
  async getRunningModels() {
    const r = await fetch(`${BASE_URL}/api/models/running`);
    return r.json();
  },
  async deleteModel(name: string) {
    const r = await fetch(`${BASE_URL}/api/models/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return r.json();
  },
  async setDefaultModel(name: string) {
    const r = await fetch(`${BASE_URL}/api/models/default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return r.json();
  },
  // System specs & recommendations
  async getSystemSpecs() {
    const r = await fetch(`${BASE_URL}/api/system/specs`);
    return r.json();
  },
  async getRecommendations() {
    const r = await fetch(`${BASE_URL}/api/system/recommendations`);
    return r.json();
  },
  // Model role assignments
  async getModelAssignments() {
    const r = await fetch(`${BASE_URL}/api/models/assignments`);
    return r.json();
  },
  async setModelAssignment(role: string, model: string) {
    const r = await fetch(`${BASE_URL}/api/models/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, model }),
    });
    return r.json();
  },
  // LM Studio
  async getLMStudioStatus() {
    const r = await fetch(`${BASE_URL}/api/lmstudio/status`);
    return r.json();
  },
  async getLMStudioModels() {
    const r = await fetch(`${BASE_URL}/api/lmstudio/models`);
    return r.json();
  },
  // System & config
  async getSystem() {
    const r = await fetch(`${BASE_URL}/api/system`);
    return r.json();
  },
  async getAgentConfig() {
    const r = await fetch(`${BASE_URL}/api/config`);
    return r.json();
  },
};

export function useWebSocket(onMessage: (data: unknown) => void): WebSocket {
  const ws = new WebSocket(`ws://localhost:7070/ws`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      // ignore malformed frames
    }
  };
  ws.onerror = () => console.log('WS disconnected');
  return ws;
}
