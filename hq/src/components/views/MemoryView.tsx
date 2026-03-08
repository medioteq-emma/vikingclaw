import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FileText, Calendar, BookOpen, RefreshCw, Search, X } from 'lucide-react';

interface MemoryData {
  memory: string;
  daily: string;
  history: string;
  date: string;
  workspace: string;
}

interface SearchResult {
  content: string;
  source: string;
  score: number;
  is_relevant: boolean;
}

type Tab = 'memory' | 'daily' | 'history' | 'search';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'memory', label: 'MEMORY.md', icon: BookOpen },
  { key: 'daily', label: "Today's Log", icon: Calendar },
  { key: 'history', label: 'History', icon: FileText },
  { key: 'search', label: 'Search', icon: Search },
];

const SOURCE_COLORS: Record<string, string> = {
  long_term: 'text-frost border-frost/30',
  daily: 'text-success border-success/30',
  history: 'text-warning border-warning/30',
};

function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-frost/20 text-frost rounded px-0.5">{part}</mark>
      : part
  );
}

export function MemoryView() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('memory');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadMemory = () => {
    setRefreshing(true);
    api.getMemory()
      .then((d: MemoryData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => { loadMemory(); }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const r = await api.searchMemory(searchQuery);
      setSearchResults(r.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const content = data
    ? activeTab === 'memory' ? data.memory
      : activeTab === 'daily' ? data.daily
      : activeTab === 'history' ? data.history
      : ''
    : '';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="frost-card scanlines relative p-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-bold text-foreground">AGENT MEMORY</h2>
          {data && (
            <p className="text-xs text-muted-foreground font-display mt-1">
              Workspace: <span className="text-frost">{data.workspace}</span>
            </p>
          )}
        </div>
        <button
          onClick={loadMemory}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-display rounded bg-primary/10 text-frost hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 font-display text-xs uppercase tracking-wider transition-colors',
              activeTab === key
                ? 'text-frost border-b-2 border-frost'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
            {key === 'daily' && data?.date && (
              <span className="text-muted-foreground">({data.date})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {activeTab === 'search' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search across all memory layers..."
                className="w-full bg-background/50 border border-border rounded pl-9 pr-10 py-2 text-sm font-body text-foreground outline-none focus:border-frost/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2 text-sm font-display font-bold rounded bg-frost text-primary-foreground hover:bg-frost/90 disabled:opacity-50 transition-colors"
            >
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'SEARCH'}
            </button>
          </div>

          {searchResults === null ? (
            <div className="frost-card scanlines relative p-4">
              <p className="text-sm text-muted-foreground font-display text-center py-8">
                Enter a query to search across MEMORY.md, today's log, and history
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="frost-card scanlines relative p-4">
              <p className="text-sm text-muted-foreground font-display text-center py-8">
                No results found for "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-display">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
              {searchResults.map((result, i) => (
                <div key={i} className="frost-card scanlines relative p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn(
                      'text-xs font-display font-bold border px-1.5 py-0.5 rounded uppercase',
                      SOURCE_COLORS[result.source] ?? 'text-muted-foreground border-border'
                    )}>
                      {result.source.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground font-display ml-auto">
                      score: {(result.score * 100).toFixed(0)}%
                    </span>
                    {result.is_relevant && (
                      <span className="text-xs text-success font-display">● RELEVANT</span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-foreground/90 leading-relaxed">
                    {highlightQuery(result.content, searchQuery)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Content Tab */
        <div className="frost-card scanlines relative p-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground font-display text-sm">
              Loading memory files...
            </div>
          ) : !content ? (
            <div className="text-center py-12 font-display text-sm">
              <p className="text-muted-foreground">
                {activeTab === 'memory' && 'MEMORY.md not found'}
                {activeTab === 'daily' && `No daily log for ${data?.date ?? 'today'}`}
                {activeTab === 'history' && 'HISTORY.md not found'}
              </p>
              <p className="text-frost/40 text-xs mt-2">{data?.workspace}</p>
            </div>
          ) : (
            <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
