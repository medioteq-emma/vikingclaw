import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader, Trash2, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE = 'http://localhost:7070';

type MessageRole = 'user' | 'agent' | 'system' | 'tool';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  ts: Date;
  thinking?: boolean;
  streaming?: boolean;
  error?: boolean;
  provider?: string; // 'lmstudio' | 'ollama' | 'cloud' | undefined
}

const STARTER_PROMPTS = [
  'What tools do you have available?',
  'Summarize my memory files',
  'List files in the workspace',
  "What is today's date and time?",
  'Run: echo "VikingClaw is alive!"',
];

function mkId() { return crypto.randomUUID(); }

export function AgentChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: '⚔️ **VikingClaw HQ Chat** — Direct line to Viking agent. Ask anything, run tools, explore memory.',
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => 'hq-' + Math.random().toString(36).slice(2, 10));
  const [agentStatus, setAgentStatus] = useState<'unknown' | 'ready' | 'offline'>('unknown');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check agent availability
  const checkStatus = useCallback(() => {
    fetch(`${BASE}/api/status`)
      .then(() => setAgentStatus('ready'))
      .catch(() => setAgentStatus('offline'));
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = useCallback((msg: Omit<ChatMessage, 'id' | 'ts'>) => {
    setMessages(prev => [...prev, { ...msg, id: mkId(), ts: new Date() }]);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    // Add user message
    addMsg({ role: 'user', content: text });

    // Add thinking placeholder
    const thinkingId = mkId();
    setMessages(prev => [...prev, {
      id: thinkingId, role: 'agent', content: '', thinking: true, ts: new Date(),
    }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      // Replace thinking with empty streaming message
      const streamId = mkId();
      setMessages(prev => [
        ...prev.filter(m => m.id !== thinkingId),
        { id: streamId, role: 'agent', content: '', streaming: true, ts: new Date() },
      ]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt: { type: string; content?: string; tool?: string; args?: string; result?: string; message?: string; provider?: string };
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          if (evt.type === 'chunk') {
            setMessages(prev => prev.map(m =>
              m.id === streamId ? { ...m, content: m.content + (evt.content ?? '') } : m
            ));
          } else if (evt.type === 'tool_start') {
            // Insert an inline tool notification above the streaming bubble
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === streamId);
              const toolMsg: ChatMessage = {
                id: mkId(),
                role: 'tool',
                content: `Running **${evt.tool}**…`,
                toolName: evt.tool,
                ts: new Date(),
              };
              if (idx === -1) return [...prev, toolMsg];
              return [...prev.slice(0, idx), toolMsg, ...prev.slice(idx)];
            });
          } else if (evt.type === 'tool_done') {
            // Update last tool message with result preview
            setMessages(prev => {
              const last = [...prev].reverse().find(m => m.role === 'tool' && m.toolName === evt.tool);
              if (!last) return prev;
              return prev.map(m =>
                m.id === last.id
                  ? { ...m, content: `✅ **${evt.tool}** → \`${(evt.result ?? '').slice(0, 120)}\`` }
                  : m
              );
            });
          } else if (evt.type === 'done') {
            setMessages(prev => prev.map(m =>
              m.id === streamId ? { ...m, streaming: false, provider: evt.provider } : m
            ));
            break;
          } else if (evt.type === 'error') {
            setMessages(prev => [
              ...prev.filter(m => m.id !== streamId),
              { id: mkId(), role: 'agent', content: `❌ ${evt.message ?? 'Unknown error'}`, error: true, ts: new Date() },
            ]);
            break;
          }
        }
      }

    } catch (e: unknown) {
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      if ((e as Error)?.name !== 'AbortError') {
        const msg = e instanceof Error ? e.message : String(e);
        addMsg({ role: 'agent', content: `❌ Could not reach Viking agent: ${msg}`, error: true });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setSending(false);
    setMessages([{
      id: 'welcome', role: 'system',
      content: '⚔️ Chat cleared. Start a new conversation.',
      ts: new Date(),
    }]);
  };

  const renderContent = (content: string, isStreaming?: boolean) => {
    const parts = content.split('\n');
    return (
      <>
        {parts.map((line, i) => (
          <span key={i}>
            {line.split(/(`[^`]+`)/).map((part, j) =>
              part.startsWith('`') && part.endsWith('`')
                ? <code key={j} className="bg-muted/60 text-frost px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
                : <span key={j}>{part.replace(/\*\*([^*]+)\*\*/g, (_m, g) => g)}</span>
            )}
            {i < parts.length - 1 && <br />}
          </span>
        ))}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-frost/80 ml-0.5 align-text-bottom animate-pulse rounded-sm" />
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] animate-fade-in">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="w-6 h-6 text-frost" />
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card',
              agentStatus === 'ready' ? 'bg-success' :
              agentStatus === 'offline' ? 'bg-destructive' : 'bg-yellow-500'
            )} />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-foreground tracking-wide">VIKING AGENT CHAT</h2>
            <p className="text-xs text-muted-foreground font-display">
              {agentStatus === 'ready'
                ? <><span className="text-success">●</span> Online · Session: {sessionId}</>
                : agentStatus === 'offline'
                ? <><span className="text-destructive">●</span> Offline · Start LM Studio or Ollama</>
                : <><span className="text-yellow-500">●</span> Connecting…</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={checkStatus}
            className="p-1.5 rounded hover:bg-muted/50 transition-colors" title="Check status">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={clearChat}
            className="p-1.5 rounded hover:bg-muted/50 transition-colors" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id}
            className={cn('flex gap-3 max-w-3xl', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
          >
            {/* Avatar */}
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              msg.role === 'user' ? 'bg-frost/20' :
              msg.role === 'system' ? 'bg-muted/50' :
              msg.role === 'tool' ? 'bg-amber-900/40' :
              'bg-purple-900/50'
            )}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-frost" /> :
               msg.role === 'tool' ? <Zap className="w-3.5 h-3.5 text-amber-400" /> :
               <Bot className="w-3.5 h-3.5 text-purple-400" />}
            </div>

            {/* Bubble */}
            <div className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[75%]',
              msg.role === 'user'
                ? 'bg-frost/10 border border-frost/20 text-foreground rounded-tr-sm'
                : msg.role === 'system'
                ? 'bg-muted/20 border border-border text-muted-foreground text-xs rounded-tl-sm'
                : msg.role === 'tool'
                ? 'bg-amber-950/30 border border-amber-800/30 text-foreground font-mono text-xs rounded-tl-sm'
                : msg.error
                ? 'bg-destructive/5 border border-destructive/30 text-foreground rounded-tl-sm'
                : 'bg-purple-950/40 border border-purple-800/30 text-foreground rounded-tl-sm'
            )}>
              {msg.thinking ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs font-display">Viking is thinking…</span>
                </div>
              ) : (
                <>
                  {msg.toolName && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-xs font-display font-bold text-amber-400">{msg.toolName}</span>
                    </div>
                  )}
                  <div>{renderContent(msg.content, msg.streaming)}</div>
                </>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground/40 font-display">
                  {msg.ts.toLocaleTimeString()}
                </span>
                {msg.role === 'agent' && !msg.thinking && msg.provider && (
                  <span className={cn(
                    'text-[10px] font-display px-1.5 py-0.5 rounded-full border',
                    msg.provider === 'lmstudio'
                      ? 'text-emerald-400 border-emerald-700/50 bg-emerald-900/20'
                      : msg.provider === 'ollama'
                      ? 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20'
                      : 'text-blue-400 border-blue-700/50 bg-blue-900/20'
                  )}>
                    via {msg.provider === 'lmstudio' ? 'LM Studio' : msg.provider === 'ollama' ? 'Ollama' : msg.provider}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Starter prompts — only when fresh */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap shrink-0">
          {STARTER_PROMPTS.map(prompt => (
            <button key={prompt}
              onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              className="text-xs font-body text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:border-frost/30 hover:text-frost transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-card/30 shrink-0">
        <div className="flex gap-3 items-end">
          <div className="flex-1 bg-background/50 border border-border rounded-xl focus-within:border-frost/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Viking… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-sm font-body text-foreground outline-none resize-none max-h-32 leading-relaxed"
              style={{ minHeight: '44px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-frost flex items-center justify-center hover:bg-frost/90 disabled:opacity-40 transition-colors shrink-0"
          >
            {sending
              ? <Loader className="w-4 h-4 text-primary-foreground animate-spin" />
              : <Send className="w-4 h-4 text-primary-foreground" />}
          </button>
        </div>
      </div>
    </div>
  );
}
