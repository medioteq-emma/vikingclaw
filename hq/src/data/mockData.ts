export const securityChecks = [
  { id: 'SEC-001', name: 'API Keys in Config', status: 'pass' as const },
  { id: 'SEC-002', name: 'Vault Encrypted', status: 'pass' as const },
  { id: 'SEC-003', name: 'Audit Log Chain Intact', status: 'pass' as const },
  { id: 'SEC-004', name: 'Workspace Permissions', status: 'pass' as const },
  { id: 'SEC-005', name: 'Ollama Exposure', status: 'warn' as const },
  { id: 'SEC-006', name: 'HQ External Access', status: 'pass' as const },
  { id: 'SEC-007', name: 'Browser Scope Isolation', status: 'pass' as const },
  { id: 'SEC-008', name: 'Memory Scope Isolation', status: 'pass' as const },
  { id: 'SEC-009', name: 'No Symlink Escapes', status: 'pass' as const },
  { id: 'SEC-010', name: 'Shell Approval Enabled', status: 'fail' as const },
];

export const auditLogEntries = [
  { time: '14:23:11', action: 'browser_click', status: 'APPROVED', actor: 'hassan' },
  { time: '14:22:59', action: 'memory_write', status: 'AUTO-OK', actor: 'system' },
  { time: '14:22:41', action: 'shell_exec', status: 'DENIED', actor: 'timeout' },
  { time: '14:21:17', action: 'llm_call', status: 'AUTO-OK', actor: 'system' },
  { time: '14:20:55', action: 'file_write', status: 'PENDING', actor: 'waiting...' },
  { time: '14:19:30', action: 'browser_nav', status: 'APPROVED', actor: 'hassan' },
  { time: '14:18:22', action: 'memory_read', status: 'AUTO-OK', actor: 'system' },
  { time: '14:17:01', action: 'api_call', status: 'APPROVED', actor: 'hassan' },
];

export const agents = [
  { id: 'main', name: 'main', status: 'active' as const, task: 'Summarize unread emails', step: 3, totalSteps: 7, currentTool: 'browser_navigate', progress: 43 },
  { id: 'research', name: 'research', status: 'idle' as const, task: null, step: 0, totalSteps: 0, currentTool: '', progress: 0 },
  { id: 'coder', name: 'coder', status: 'paused' as const, task: 'Refactor auth module', step: 1, totalSteps: 4, currentTool: 'file_read', progress: 25 },
];

export const approvals = [
  { id: '1', agent: 'main', tool: 'shell_exec', command: 'rm -rf ./temp/old_cache', risk: 'HIGH' as const, expiresIn: 47, description: 'Irreversible file deletion' },
  { id: '2', agent: 'coder', tool: 'file_write', command: './src/auth/token.ts', risk: 'MEDIUM' as const, expiresIn: 52, description: 'Overwrite authentication module' },
];

export const memories = [
  { id: '1', scope: 'work' as const, title: 'Q2 Product Roadmap Notes', preview: 'Discussed NEXUS Health mobile-first approach with team leads. Focus on patient portal UX...', tags: ['nexus', 'roadmap', 'medioteq'], decay: 78, addedDays: 3, lastAccessed: '6 hours ago' },
  { id: '2', scope: 'work' as const, title: 'Competitor Analysis: EPIC vs NEXUS', preview: 'EPIC has 250+ hospital installations. Key differentiator for NEXUS is AI-first triage...', tags: ['epic', 'competitor', 'analysis'], decay: 92, addedDays: 1, lastAccessed: '1 hour ago' },
  { id: '3', scope: 'work' as const, title: 'API Integration Notes — Medioteq', preview: 'REST endpoints for patient data sync. Auth via OAuth2 with refresh tokens. Rate limit 100/min...', tags: ['api', 'medioteq', 'integration'], decay: 45, addedDays: 12, lastAccessed: '3 days ago' },
  { id: '4', scope: 'personal' as const, title: 'Travel Plans — Summer 2025', preview: 'Norway fjord cruise departing Oslo. Booking confirmation #VK-2847...', tags: ['travel', 'norway'], decay: 88, addedDays: 2, lastAccessed: '12 hours ago' },
  { id: '5', scope: 'work' as const, title: 'Sprint Retrospective Notes', preview: 'Team velocity improved 15%. Bottleneck in code review pipeline...', tags: ['sprint', 'agile'], decay: 65, addedDays: 7, lastAccessed: '2 days ago' },
  { id: '6', scope: 'medical' as const, title: 'Appointment Reminders', preview: 'Dr. Erikson — Annual checkup scheduled for March 15. Fasting required...', tags: ['health', 'appointment'], decay: 95, addedDays: 1, lastAccessed: '30 min ago' },
  { id: '7', scope: 'home' as const, title: 'Smart Home Automation Rules', preview: 'Lights dim at 22:00, thermostat to 19°C. Motion sensors in garage...', tags: ['iot', 'automation'], decay: 72, addedDays: 5, lastAccessed: '1 day ago' },
  { id: '8', scope: 'work' as const, title: 'Database Migration Plan', preview: 'PostgreSQL 15 → 16 migration. Estimated downtime: 4 min. Rollback strategy documented...', tags: ['database', 'migration', 'devops'], decay: 55, addedDays: 10, lastAccessed: '4 days ago' },
];

export const models = {
  installed: [
    { name: 'llama3:8b', size: '4.7GB', ramUse: '6.2GB', speed: 24, status: 'loaded' as const },
    { name: 'phi3:mini', size: '2.3GB', ramUse: '3.1GB', speed: 51, status: 'ready' as const },
    { name: 'nomic-embed-text', size: '270MB', ramUse: '400MB', speed: 0, status: 'ready' as const },
    { name: 'deepseek-r1:7b', size: '4.9GB', ramUse: '6.4GB', speed: 18, status: 'unloaded' as const },
  ],
  available: [
    { name: 'Mistral 7B Instruct', quant: 'Q4_K_M', size: '4.1GB', compatible: true, bestFor: 'General, Coding', rating: 4.8, downloads: '4.8k' },
    { name: 'CodeLlama 13B', quant: 'Q4_K_M', size: '7.3GB', compatible: true, bestFor: 'Code Generation', rating: 4.6, downloads: '3.2k' },
    { name: 'LLaVA 13B', quant: 'Q4_K_M', size: '7.8GB', compatible: false, bestFor: 'Vision, Multimodal', rating: 4.5, downloads: '2.1k' },
    { name: 'Gemma 2B', quant: 'Q4_K_M', size: '1.5GB', compatible: true, bestFor: 'Quick Tasks', rating: 4.3, downloads: '5.6k' },
  ],
};

export const budgetHistory = [0.8, 1.2, 0.4, 2.1, 1.8, 0.9, 1.5, 0.6, 1.9, 2.3, 1.1, 0.7, 1.4, 1.6, 0.5, 2.0, 1.3, 0.8, 1.7, 1.2, 0.9, 1.5, 1.8, 0.6, 1.4, 2.2, 0.7, 1.1, 1.3, 1.23];

export const budgetBreakdown = [
  { model: 'llama3:8b (local)', inputTokens: 47220, outputTokens: 12840, cost: 0.00, local: true },
  { model: 'phi3:mini (local)', inputTokens: 8100, outputTokens: 2200, cost: 0.00, local: true },
  { model: 'claude-haiku (cloud)', inputTokens: 12400, outputTokens: 3100, cost: 0.89, local: false },
  { model: 'gpt-4o-mini (cloud)', inputTokens: 6200, outputTokens: 1800, cost: 0.34, local: false },
];

export const workflows = [
  { id: '1', name: 'Daily Email Digest', trigger: 'CRON', schedule: '08:00', status: 'success' as const, lastRun: '2h ago' },
  { id: '2', name: 'Weekly Report', trigger: 'CRON', schedule: 'Mon', status: 'failed' as const, lastRun: 'failed' },
  { id: '3', name: 'New File Processor', trigger: 'FILE', schedule: 'watch', status: 'running' as const, lastRun: 'now' },
  { id: '4', name: 'Slack Summarizer', trigger: 'WEBHOOK', schedule: '', status: 'paused' as const, lastRun: '1d ago' },
];

export const browserSessions = [
  { id: '1', profile: 'WORK', tab: 'gmail.com — Inbox (23 unread)', antiFingerprint: true, agentControl: 'AUTO' },
  { id: '2', profile: 'RESEARCH', tab: 'arxiv.org — Search Results', antiFingerprint: true, agentControl: 'MANUAL' },
];

export const syncFeed = [
  { time: '14:23:09', direction: 'up' as const, action: 'Pushed 12 memory updates → iPhone' },
  { time: '14:22:55', direction: 'down' as const, action: 'Pulled 3 new memories ← iPhone' },
  { time: '14:15:01', direction: 'up' as const, action: 'Pushed 1 workflow result → iPhone' },
  { time: '13:00:00', direction: 'sync' as const, action: 'Auto-sync completed (47 items verified)' },
];
