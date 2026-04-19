import React, { useState } from 'react';
import { Code, BarChart, Plug, Terminal, Settings, ChevronRight } from 'lucide-react';

export default function StudioDashboard() {
  const [activeTab, setActiveTab] = useState('intelligence');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Terminal className="w-6 h-6 text-indigo-400" />
          <span className="text-xl font-bold tracking-tight text-indigo-50">MyCodexVantaOS Dev Studio</span>
        </div>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">
            Get Started
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center cursor-pointer">
            <Settings className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col p-4 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Capabilities</div>
          <button 
            onClick={() => setActiveTab('intelligence')}
            className={\`flex items-center space-x-3 w-full px-3 py-2 rounded-md transition-colors \${activeTab === 'intelligence' ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-gray-700 text-gray-300'}\`}
          >
            <Code className="w-4 h-4" />
            <span className="text-sm font-medium">Code Intelligence</span>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={\`flex items-center space-x-3 w-full px-3 py-2 rounded-md transition-colors \${activeTab === 'analytics' ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-gray-700 text-gray-300'}\`}
          >
            <BarChart className="w-4 h-4" />
            <span className="text-sm font-medium">Ecosystem Analytics</span>
          </button>
          <button 
            onClick={() => setActiveTab('extensions')}
            className={\`flex items-center space-x-3 w-full px-3 py-2 rounded-md transition-colors \${activeTab === 'extensions' ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-gray-700 text-gray-300'}\`}
          >
            <Plug className="w-4 h-4" />
            <span className="text-sm font-medium">Extensions Registry</span>
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto bg-gray-900">
          <header className="mb-10 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">
              The Next Evolution of Code Intelligence
            </h1>
            <p className="text-lg text-gray-400">
              An open, extensible platform to build, analyze, and collaborate on the future of code editing.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature Card 1 */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
              <div className="w-12 h-12 bg-indigo-900/30 rounded-lg flex items-center justify-center mb-4">
                <Code className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Unified Development</h3>
              <p className="text-sm text-gray-400 mb-4 h-16">
                Enhance your workflow with AI-driven code completion, inline suggestions, and a conversational LLM assistant.
              </p>
              <button className="flex items-center text-indigo-400 text-sm font-medium hover:text-indigo-300">
                Launch Assistant <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-green-500/50 transition-colors">
              <div className="w-12 h-12 bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <BarChart className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Market & Governance</h3>
              <p className="text-sm text-gray-400 mb-4 h-16">
                Utilize powerful telemetry visualizations to analyze code editor ecosystems, market trends, and architecture drift.
              </p>
              <button className="flex items-center text-green-400 text-sm font-medium hover:text-green-300">
                View Analytics <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500/50 transition-colors">
              <div className="w-12 h-12 bg-orange-900/30 rounded-lg flex items-center justify-center mb-4">
                <Plug className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Community Extensions</h3>
              <p className="text-sm text-gray-400 mb-4 h-16">
                Customize your experience by browsing, installing, and managing a wide range of governed, community-built extensions.
              </p>
              <button className="flex items-center text-orange-400 text-sm font-medium hover:text-orange-300">
                Browse Registry <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
