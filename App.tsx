
import React, { useState, useRef, useEffect } from 'react';
import { Message, SavedAnswer, BibleVersion } from './types';
import { getBibleWisdom } from './services/geminiService';
import ChatMessage from './components/ChatMessage';

const BIBLE_VERSIONS: BibleVersion[] = ['NIV', 'KJV', 'ESV', 'NLT', 'NKJV', 'NASB'];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome. What spiritual wisdom do you seek today?',
      timestamp: new Date()
    }
  ]);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [bibleVersion, setBibleVersion] = useState<BibleVersion>('NIV');
  const [showFavorites, setShowFavorites] = useState(false);
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load state from local storage
  useEffect(() => {
    const storedFavorites = localStorage.getItem('bible_favorites');
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites);
        setSavedAnswers(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }

    const storedVersion = localStorage.getItem('bible_version');
    if (storedVersion && BIBLE_VERSIONS.includes(storedVersion as BibleVersion)) {
      setBibleVersion(storedVersion as BibleVersion);
    }
  }, []);

  // Persist state to local storage
  useEffect(() => {
    localStorage.setItem('bible_favorites', JSON.stringify(savedAnswers));
  }, [savedAnswers]);

  useEffect(() => {
    localStorage.setItem('bible_version', bibleVersion);
  }, [bibleVersion]);

  const scrollToBottom = (instant = false) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isOverflowing = container.scrollHeight > container.clientHeight;
    
    // Only scroll if the content actually exceeds the visible area
    if (isOverflowing) {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth',
        block: 'end'
      });
    }
  };

  useEffect(() => {
    // Small delay helps with mobile keyboard layout shifts
    const timer = setTimeout(() => {
      if (messages.length > 1 || isLoading) {
        scrollToBottom();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const toggleFavorite = (message: Message) => {
    if (!message.metadata) return;

    const existingIndex = savedAnswers.findIndex(s => s.id === message.id);
    if (existingIndex > -1) {
      setSavedAnswers(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      const userMsg = messages.find((m, i) => messages[i+1]?.id === message.id && m.role === 'user');
      const newFavorite: SavedAnswer = {
        id: message.id,
        question: userMsg?.content || "Spiritual Question",
        answer: message.content,
        reference: message.metadata.reference,
        topic: message.metadata.topic,
        explanation: message.metadata.explanation,
        version: message.metadata.version || bibleVersion,
        timestamp: new Date()
      };
      setSavedAnswers(prev => [newFavorite, ...prev]);
    }
  };

  const removeFavorite = (id: string) => {
    setSavedAnswers(prev => prev.filter(s => s.id !== id));
  };

  const handleSend = async (e?: React.FormEvent, retryInput?: string) => {
    e?.preventDefault();
    const textToSend = retryInput || input;
    if (!textToSend.trim() || isLoading) return;

    setLastError(null);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    if (!retryInput) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
    }
    
    setIsLoading(true);

    try {
      const result = await getBibleWisdom(textToSend, bibleVersion);
      
      if (result.error) {
        throw new Error(result.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        metadata: {
          reference: result.reference,
          topic: result.topic,
          explanation: result.explanation,
          version: bibleVersion
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat Error:", error);
      setLastError(error instanceof Error ? error.message : "Connection interrupted. Please check your network.");
    } finally {
      setIsLoading(false);
      // Keep focus on mobile
      if (window.innerWidth < 768) {
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc]">
      {/* Header */}
      <header className="flex-shrink-0 z-50 glass h-16 flex items-center px-4 md:px-6">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-book-bible text-sm md:text-lg"></i>
            </div>
            <div className="hidden xs:block">
              <h1 className="font-serif text-lg md:text-xl font-bold text-slate-800">BibleWisdom</h1>
              <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-indigo-600 font-bold">Divine Insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative group">
              <select 
                value={bibleVersion}
                onChange={(e) => setBibleVersion(e.target.value as BibleVersion)}
                className="appearance-none bg-white border border-slate-200 rounded-xl px-2 py-1.5 md:px-3 md:py-2 pr-7 text-[10px] md:text-xs font-bold text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
              >
                {BIBLE_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <button 
              onClick={() => setShowFavorites(true)}
              className="relative flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-xs md:text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <i className="fa-solid fa-heart text-rose-500"></i>
              <span className="hidden sm:inline">Saved</span>
              {savedAnswers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-rose-500 text-white text-[8px] md:text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
                  {savedAnswers.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-10 pb-6"
      >
        <div className="max-w-4xl mx-auto flex flex-col min-h-full">
          {/* Top spacer to ensure first message isn't too close to header */}
          <div className="h-6 w-full flex-shrink-0" />
          
          {messages.map((msg) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              onSave={toggleFavorite}
              isSaved={savedAnswers.some(s => s.id === msg.id)}
            />
          ))}
          
          {isLoading && (
            <div className="flex justify-start mb-6 animate-pulse">
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}

          {lastError && (
            <div className="mb-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2 shadow-sm">
                <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
                {lastError}
              </div>
              <button 
                onClick={() => handleSend(undefined, messages[messages.length - 1]?.content)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <i className="fa-solid fa-rotate-right"></i>
                Try Connection Again
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" />
        </div>
      </main>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 pb-8 md:pb-6 bg-slate-50/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto">
          <form 
            onSubmit={handleSend}
            className="relative flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask for ${bibleVersion} wisdom...`}
                className="w-full bg-white border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 rounded-2xl py-3.5 pl-5 pr-12 text-sm transition-all duration-200 shadow-sm outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  input.trim() && !isLoading 
                  ? 'bg-indigo-600 text-white scale-100 shadow-md hover:bg-indigo-700' 
                  : 'bg-slate-100 text-slate-300 scale-90'
                }`}
              >
                <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              </button>
            </div>
          </form>
          <p className="text-center text-[9px] md:text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">
            Divine Wisdom in {bibleVersion} &bull; Always Accessible
          </p>
        </div>
      </div>

      {/* Favorites Modal Overlay */}
      {showFavorites && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFavorites(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-heart text-rose-500 text-xl"></i>
                <h2 className="font-serif text-lg md:text-xl font-bold text-slate-800">Saved Wisdom</h2>
              </div>
              <button 
                onClick={() => setShowFavorites(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
              {savedAnswers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-bookmark text-3xl"></i>
                  </div>
                  <p className="text-slate-400 font-medium text-sm">No saved items yet.</p>
                  <p className="text-[10px] text-slate-300 mt-1 uppercase tracking-widest">Your favorite verses will appear here</p>
                </div>
              ) : (
                savedAnswers.map((item) => (
                  <div key={item.id} className="group relative bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-indigo-100 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {item.topic}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded uppercase">
                          {item.version}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeFavorite(item.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mb-2">"{item.question}"</p>
                    <p className="text-slate-800 text-sm font-medium leading-relaxed mb-1">
                      {item.answer}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] font-bold text-slate-400">— {item.reference}</p>
                      {item.explanation && (
                        <button 
                          onClick={() => setExpandedSavedId(expandedSavedId === item.id ? null : item.id)}
                          className="text-[9px] font-bold text-indigo-500 uppercase hover:underline"
                        >
                          {expandedSavedId === item.id ? 'Hide Detail' : 'Show Detail'}
                        </button>
                      )}
                    </div>
                    {expandedSavedId === item.id && item.explanation && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 leading-relaxed animate-in fade-in slide-in-from-top-1">
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decorative background elements */}
      <div className="fixed top-20 left-10 w-48 h-48 md:w-64 md:h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
      <div className="fixed bottom-40 right-10 w-48 h-48 md:w-64 md:h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
    </div>
  );
};

export default App;
