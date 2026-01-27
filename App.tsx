
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
  const [darkMode, setDarkMode] = useState(false);
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

    const storedDarkMode = localStorage.getItem('bible_dark_mode');
    if (storedDarkMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  // Persist state to local storage
  useEffect(() => {
    localStorage.setItem('bible_favorites', JSON.stringify(savedAnswers));
  }, [savedAnswers]);

  useEffect(() => {
    localStorage.setItem('bible_version', bibleVersion);
  }, [bibleVersion]);

  useEffect(() => {
    localStorage.setItem('bible_dark_mode', darkMode.toString());
  }, [darkMode]);

  const scrollToBottom = (instant = false) => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isOverflowing = container.scrollHeight > container.clientHeight;
    
    if (isOverflowing) {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: instant ? 'auto' : 'smooth',
        block: 'end'
      });
    }
  };

  useEffect(() => {
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
      if (window.innerWidth < 768) {
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      {/* Header */}
      <header className={`flex-shrink-0 z-50 glass h-16 flex items-center px-4 md:px-6 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-book-bible text-sm md:text-lg"></i>
            </div>
            <div className="hidden xs:block">
              <h1 className={`font-serif text-lg md:text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>BibleWisdom</h1>
              <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-indigo-500 font-bold">Divine Insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${darkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            >
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>

            <div className="relative group">
              <select 
                value={bibleVersion}
                onChange={(e) => setBibleVersion(e.target.value as BibleVersion)}
                className={`appearance-none rounded-xl px-2 py-1.5 md:px-3 md:py-2 pr-7 text-[10px] md:text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {BIBLE_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <button 
              onClick={() => setShowFavorites(true)}
              className={`relative flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm active:scale-95 ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
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
          <div className="h-6 w-full flex-shrink-0" />
          
          {messages.map((msg) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              onSave={toggleFavorite}
              isSaved={savedAnswers.some(s => s.id === msg.id)}
              isDarkMode={darkMode}
            />
          ))}
          
          {isLoading && (
            <div className="flex justify-start mb-6 animate-pulse">
              <div className={`px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}

          {lastError && (
            <div className="mb-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
              <div className={`px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2 shadow-sm ${darkMode ? 'bg-rose-950/30 border-rose-900/50 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
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
      <div className={`flex-shrink-0 p-4 pb-8 md:pb-6 backdrop-blur-md border-t transition-colors ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
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
                className={`w-full rounded-2xl py-3.5 pl-5 pr-12 text-sm transition-all duration-200 shadow-sm outline-none border-2 ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                }`}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  input.trim() && !isLoading 
                  ? 'bg-indigo-600 text-white scale-100 shadow-md hover:bg-indigo-700' 
                  : 'bg-slate-200 text-slate-400 scale-90'
                }`}
              >
                <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              </button>
            </div>
          </form>
          <p className={`text-center text-[9px] md:text-[10px] mt-2 font-medium uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Divine Wisdom in {bibleVersion} &bull; Always Accessible
          </p>
        </div>
      </div>

      {/* Favorites Modal Overlay */}
      {showFavorites && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFavorites(false)}></div>
          <div className={`relative w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className={`p-5 md:p-6 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-heart text-rose-500 text-xl"></i>
                <h2 className={`font-serif text-lg md:text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Saved Wisdom</h2>
              </div>
              <button 
                onClick={() => setShowFavorites(false)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
              {savedAnswers.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-slate-800 text-slate-700' : 'bg-slate-50 text-slate-200'}`}>
                    <i className="fa-solid fa-bookmark text-3xl"></i>
                  </div>
                  <p className="text-slate-500 font-medium text-sm">No saved items yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Your favorite verses will appear here</p>
                </div>
              ) : (
                savedAnswers.map((item) => (
                  <div key={item.id} className={`group relative rounded-2xl p-4 border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-slate-50 border-slate-100 hover:border-indigo-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${darkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          {item.topic}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-400'}`}>
                          {item.version}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeFavorite(item.id)}
                        className="text-slate-500 hover:text-rose-500 transition-colors p-1"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                    <p className={`text-[11px] italic mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>"{item.question}"</p>
                    <p className={`text-sm font-medium leading-relaxed mb-1 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {item.answer}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className={`text-[10px] font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>— {item.reference}</p>
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
                      <div className={`mt-3 pt-3 border-t text-[11px] leading-relaxed animate-in fade-in slide-in-from-top-1 ${darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-600'}`}>
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
      <div className={`fixed top-20 left-10 w-48 h-48 md:w-64 md:h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none transition-colors duration-1000 ${darkMode ? 'bg-indigo-900' : 'bg-indigo-200'}`}></div>
      <div className={`fixed bottom-40 right-10 w-48 h-48 md:w-64 md:h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none transition-colors duration-1000 ${darkMode ? 'bg-amber-900' : 'bg-amber-200'}`}></div>
    </div>
  );
};

export default App;
