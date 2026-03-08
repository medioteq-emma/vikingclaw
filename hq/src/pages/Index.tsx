import { useState } from 'react';
import { Topbar } from '@/components/viking/Topbar';
import { Sidebar, ViewId } from '@/components/viking/Sidebar';
import { SecurityView } from '@/components/views/SecurityView';
import { AgentsView } from '@/components/views/AgentsView';
import { MemoryView } from '@/components/views/MemoryView';
import { ModelsView } from '@/components/views/ModelsView';
import { BrowserView } from '@/components/views/BrowserView';
import { AutomationView } from '@/components/views/AutomationView';
import { BudgetView } from '@/components/views/BudgetView';
import { MobileView } from '@/components/views/MobileView';
import { AgentChatView } from '@/components/views/AgentChatView';
import { MindMapView } from '@/components/views/MindMapView';
import { FunctionCallerView } from '@/components/views/FunctionCallerView';
import { SystemView } from '@/components/views/SystemView';
import { GoogleView } from '@/components/views/GoogleView';

const views: Record<ViewId, React.ComponentType> = {
  security: SecurityView,
  agents: AgentsView,
  memory: MemoryView,
  models: ModelsView,
  browser: BrowserView,
  automation: AutomationView,
  budget: BudgetView,
  mobile: MobileView,
  chat: AgentChatView,
  mindmap: MindMapView,
  functions: FunctionCallerView,
  system: SystemView,
  google: GoogleView,
};

const Index = () => {
  const [activeView, setActiveView] = useState<ViewId>('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const ActiveComponent = views[activeView];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={activeView}
          onChange={setActiveView}
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(e => !e)}
        />
        <main className="flex-1 overflow-y-auto">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
};

export default Index;
