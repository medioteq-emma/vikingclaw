import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '@/lib/api';

// ── custom node types ──────────────────────────────────────────

function AgentNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '14px 20px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #2d1b69 0%, #1a0e3d 100%)',
      border: '2px solid #7c3aed',
      boxShadow: '0 0 24px rgba(124,58,237,0.6), 0 0 48px rgba(124,58,237,0.2)',
      color: '#e9d5ff',
      fontFamily: 'monospace',
      minWidth: 140,
      textAlign: 'center',
    }}>
      <Handle type="source" position={Position.Right} style={{ background: '#7c3aed', border: 'none' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#7c3aed', border: 'none' }} />
      <div style={{ fontSize: 22, marginBottom: 4 }}>⚔️</div>
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{data.label}</div>
      <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 3 }}>{data.sub}</div>
    </div>
  );
}

function MemoryNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: 'rgba(16, 185, 129, 0.08)',
      border: '1.5px solid rgba(16,185,129,0.4)',
      boxShadow: '0 0 12px rgba(16,185,129,0.15)',
      color: '#6ee7b7',
      fontFamily: 'monospace',
      minWidth: 110,
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#10b981', border: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#10b981', border: 'none' }} />
      <div style={{ fontSize: 14, marginBottom: 2 }}>🧠</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</div>
      {data.sub && <div style={{ fontSize: 9, color: '#6ee7b7', opacity: 0.7, marginTop: 2 }}>{data.sub}</div>}
    </div>
  );
}

function ToolNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1.5px solid rgba(245,158,11,0.4)',
      boxShadow: '0 0 12px rgba(245,158,11,0.15)',
      color: '#fcd34d',
      fontFamily: 'monospace',
      minWidth: 110,
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b', border: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b', border: 'none' }} />
      <div style={{ fontSize: 14, marginBottom: 2 }}>⚡</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</div>
      {data.sub && <div style={{ fontSize: 9, color: '#fcd34d', opacity: 0.7, marginTop: 2 }}>{data.sub}</div>}
    </div>
  );
}

function ModelNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: 'rgba(99, 102, 241, 0.08)',
      border: '1.5px solid rgba(99,102,241,0.4)',
      boxShadow: '0 0 12px rgba(99,102,241,0.15)',
      color: '#a5b4fc',
      fontFamily: 'monospace',
      minWidth: 120,
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#6366f1', border: 'none' }} />
      <div style={{ fontSize: 14, marginBottom: 2 }}>🤖</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</div>
      {data.sub && <div style={{ fontSize: 9, color: '#a5b4fc', opacity: 0.7, marginTop: 2 }}>{data.sub}</div>}
    </div>
  );
}

function AutomationNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: 8,
      background: 'rgba(236, 72, 153, 0.08)',
      border: '1.5px solid rgba(236,72,153,0.4)',
      boxShadow: '0 0 12px rgba(236,72,153,0.15)',
      color: '#f9a8d4',
      fontFamily: 'monospace',
      minWidth: 110,
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#ec4899', border: 'none' }} />
      <div style={{ fontSize: 14, marginBottom: 2 }}>🔄</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</div>
      {data.sub && <div style={{ fontSize: 9, color: '#f9a8d4', opacity: 0.7, marginTop: 2 }}>{data.sub}</div>}
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  memory: MemoryNode,
  tool: ToolNode,
  model: ModelNode,
  automation: AutomationNode,
};

// ── edge style helpers ─────────────────────────────────────────

const edgeStyle = (color: string) => ({
  stroke: color,
  strokeWidth: 1.5,
  filter: `drop-shadow(0 0 4px ${color})`,
});

// ── build graph from data ─────────────────────────────────────

function buildGraph(
  models: { name: string; size?: number }[],
  rules: { id: string; name: string; enabled: boolean }[],
  tools: { name: string; description: string }[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Agent (center)
  nodes.push({
    id: 'agent',
    type: 'agent',
    position: { x: 500, y: 300 },
    data: { label: 'VIKING', sub: 'AI Agent' },
  });

  // Memory nodes (left column)
  const memItems = [
    { id: 'mem-long', label: 'MEMORY.md', sub: 'long-term' },
    { id: 'mem-daily', label: 'Daily Log', sub: 'today' },
    { id: 'mem-hist', label: 'History', sub: 'events' },
  ];
  memItems.forEach((m, i) => {
    nodes.push({ id: m.id, type: 'memory', position: { x: 80, y: 160 + i * 110 }, data: { label: m.label, sub: m.sub } });
    edges.push({ id: `e-${m.id}`, source: 'agent', target: m.id, animated: true, style: edgeStyle('#10b981'), type: 'smoothstep' });
  });

  // Tool nodes (top)
  const toolList = tools.length > 0 ? tools : [
    { name: 'shell', description: 'Run commands' },
    { name: 'filesystem', description: 'Read/write files' },
    { name: 'web', description: 'Fetch URLs' },
  ];
  toolList.slice(0, 5).forEach((t, i) => {
    const id = `tool-${t.name}`;
    nodes.push({ id, type: 'tool', position: { x: 300 + i * 145, y: 60 }, data: { label: t.name, sub: t.description?.slice(0, 20) } });
    edges.push({ id: `e-${id}`, source: 'agent', target: id, animated: false, style: edgeStyle('#f59e0b'), type: 'smoothstep' });
  });

  // Model nodes (right column)
  const modelList = models.slice(0, 6);
  if (modelList.length === 0) modelList.push({ name: 'ollama (offline)', size: 0 });
  modelList.forEach((m, i) => {
    const id = `model-${i}`;
    const shortName = m.name.split(':')[0];
    const sizeGB = m.size ? (m.size / 1e9).toFixed(1) + ' GB' : '';
    nodes.push({ id, type: 'model', position: { x: 920, y: 100 + i * 110 }, data: { label: shortName, sub: sizeGB } });
    edges.push({ id: `e-${id}`, source: 'agent', target: id, animated: false, style: edgeStyle('#6366f1'), type: 'smoothstep' });
  });

  // Automation nodes (bottom)
  const ruleList = rules.slice(0, 5);
  ruleList.forEach((rule, i) => {
    const id = `auto-${rule.id}`;
    nodes.push({
      id, type: 'automation',
      position: { x: 280 + i * 160, y: 520 },
      data: { label: rule.name.slice(0, 16), sub: rule.enabled ? '● active' : '○ paused' },
    });
    edges.push({ id: `e-${id}`, source: 'agent', target: id, animated: rule.enabled, style: edgeStyle('#ec4899'), type: 'smoothstep' });
  });

  return { nodes, edges };
}

// ── main component ─────────────────────────────────────────────

export function MindMapView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState<{ label: string; sub?: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadGraph = useCallback(async () => {
    try {
      const [modelsRes, rulesRes, toolsRes] = await Promise.allSettled([
        api.getModels(),
        api.getAutomationRules(),
        api.getToolsList(),
      ]);
      const models = modelsRes.status === 'fulfilled' ? (modelsRes.value.models ?? []) : [];
      const rules = rulesRes.status === 'fulfilled' ? (rulesRes.value.rules ?? []) : [];
      const tools = toolsRes.status === 'fulfilled' ? (toolsRes.value.tools ?? []) : [];
      const { nodes: n, edges: e } = buildGraph(models, rules, tools);
      setNodes(n);
      setEdges(e);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
    const interval = setInterval(loadGraph, 10000);
    return () => clearInterval(interval);
  }, [loadGraph]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 52px)', background: '#0a0e1a', position: 'relative' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 8, padding: '10px 14px', fontSize: 11, fontFamily: 'monospace',
        color: '#94a3b8', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>MIND MAP LEGEND</div>
        {[
          { color: '#7c3aed', label: 'Agent' },
          { color: '#10b981', label: 'Memory' },
          { color: '#f59e0b', label: 'Tools' },
          { color: '#6366f1', label: 'Models' },
          { color: '#ec4899', label: 'Automation' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, display: 'inline-block', boxShadow: `0 0 6px ${l.color}` }} />
            {l.label}
          </div>
        ))}
        <div style={{ marginTop: 6, color: '#475569', fontSize: 10 }}>
          Refreshed: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Selected node info */}
      {selected && (
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 8, padding: '10px 14px', fontSize: 11, fontFamily: 'monospace',
          color: '#e2e8f0', backdropFilter: 'blur(8px)', maxWidth: 200,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{selected.label}</div>
          {selected.sub && <div style={{ color: '#94a3b8' }}>{selected.sub}</div>}
          <button
            onClick={() => setSelected(null)}
            style={{ marginTop: 6, fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ✕ close
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelected(node.data as { label: string; sub?: string })}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={2}
        style={{ background: '#0a0e1a' }}
      >
        <Background color="#1e293b" gap={24} size={1} />
        <Controls style={{ background: 'rgba(10,14,26,0.8)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8 }} />
        <MiniMap
          style={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(124,58,237,0.2)' }}
          nodeColor={(n) => {
            if (n.type === 'agent') return '#7c3aed';
            if (n.type === 'memory') return '#10b981';
            if (n.type === 'tool') return '#f59e0b';
            if (n.type === 'model') return '#6366f1';
            return '#ec4899';
          }}
          maskColor="rgba(10,14,26,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
