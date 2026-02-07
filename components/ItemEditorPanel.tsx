
import React from 'react';
import { ServiceItem } from '../types';
import { DEFAULT_BACKGROUNDS } from '../constants';
import { PlusIcon } from './Icons';

interface ItemEditorPanelProps {
  item: ServiceItem;
  onUpdate: (updatedItem: ServiceItem) => void;
  onOpenLibrary?: () => void;
}

export const ItemEditorPanel: React.FC<ItemEditorPanelProps> = ({ item, onUpdate, onOpenLibrary }) => {
  
  const updateTheme = (updates: Partial<typeof item.theme>) => {
    onUpdate({
      ...item,
      theme: { ...item.theme, ...updates }
    });
  };

  const updateTitle = (newTitle: string) => {
    onUpdate({ ...item, title: newTitle });
  };

  return (
    <div className="bg-zinc-950 border-b border-zinc-900 p-3 flex flex-col gap-3">
      {/* Title Editor */}
      <div className="flex-1">
        <input 
          type="text" 
          value={item.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="bg-zinc-900 text-lg font-bold text-zinc-200 focus:outline-none border border-zinc-800 focus:border-blue-600 w-full px-3 py-1.5 rounded-sm placeholder-zinc-700 transition-colors"
          placeholder="Item Title"
        />
      </div>

      {/* Theme Controls Bar */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1">
        
        {/* Font Size */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Size</span>
          <div className="flex bg-zinc-900 rounded-sm border border-zinc-800 p-0.5">
             {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                <button 
                  key={size}
                  onClick={() => updateTheme({ fontSize: size })}
                  className={`px-2 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontSize === size ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title={size}
                >
                  {size === 'small' ? 'SM' : size === 'medium' ? 'MD' : size === 'large' ? 'LG' : 'XL'}
                </button>
             ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Typeface</span>
          <div className="flex bg-zinc-900 rounded-sm border border-zinc-800 p-0.5">
             <button 
               onClick={() => updateTheme({ fontFamily: 'sans-serif' })}
               className={`px-3 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontFamily === 'sans-serif' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Sans
             </button>
             <button 
               onClick={() => updateTheme({ fontFamily: 'serif' })}
               className={`px-3 py-0.5 text-[10px] rounded-sm font-medium transition-colors ${item.theme.fontFamily === 'serif' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Serif
             </button>
          </div>
        </div>

        {/* Background Picker */}
        <div className="flex flex-col gap-1">
           <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Background</span>
           <div className="flex gap-1">
              {DEFAULT_BACKGROUNDS.slice(0, 5).map((url, i) => (
                  <button 
                    key={i}
                    onClick={() => updateTheme({ backgroundUrl: url })}
                    className={`w-6 h-6 rounded-sm border ${item.theme.backgroundUrl === url ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-800 opacity-60 hover:opacity-100'} bg-cover bg-center transition-all`}
                    style={{ backgroundImage: `url(${url})` }}
                  />
              ))}
              {onOpenLibrary && (
                <button 
                    onClick={onOpenLibrary}
                    className="w-6 h-6 rounded-sm border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-all"
                    title="Open Motion Library"
                >
                    <PlusIcon className="w-3 h-3" />
                </button>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
