
import React, { useState } from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  onSave?: (msg: Message) => void;
  isSaved?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSave, isSaved }) => {
  const isUser = message.role === 'user';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
          isUser ? 'bg-indigo-600 text-white' : 'bg-amber-100 text-amber-700'
        }`}>
          {isUser ? <i className="fa-solid fa-user"></i> : <i className="fa-solid fa-dove"></i>}
        </div>
        
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm relative group transition-all duration-300 ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
          }`}>
            <div className="font-medium">{message.content}</div>
            
            {!isUser && message.metadata && (
              <>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-slate-600 text-xs italic animate-in fade-in slide-in-from-top-1 duration-300">
                    {message.metadata.explanation}
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-600 italic">
                      — {message.metadata.reference}
                    </span>
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className={`text-[9px] font-bold uppercase tracking-tighter transition-all px-2 py-0.5 rounded-full ${
                        isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {isExpanded ? 'Close' : 'Deepen Wisdom'}
                    </button>
                  </div>
                  {onSave && (
                    <button 
                      onClick={() => onSave(message)}
                      className={`text-xs transition-colors p-1 rounded-full ${isSaved ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                      title={isSaved ? "Saved to favorites" : "Save to favorites"}
                    >
                      <i className={`fa-${isSaved ? 'solid' : 'regular'} fa-heart`}></i>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-medium flex items-center gap-2">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {!isUser && message.metadata && (
              <>
                <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-[9px] text-indigo-500 border border-indigo-100 uppercase font-bold tracking-tighter">
                  {message.metadata.version}
                </span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-500 border border-slate-200 uppercase font-bold tracking-tighter">
                  {message.metadata.topic}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
