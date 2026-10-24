import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AIDrawer } from '../ai/AIDrawer';

export const AppLayout: React.FC = () => {
  const [isAIOpen, setIsAIOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Topbar onOpenAI={() => setIsAIOpen(true)} />
        <main className="flex-1 mt-16 p-8">
          <Outlet />
        </main>
      </div>

      {/* AI Assistant Drawer */}
      <AIDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
};
