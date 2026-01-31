
import React, { useState, useRef, useEffect } from 'react';
import { Message, SavedAnswer, BibleVersion, AiSettings } from './types';
import { getBibleWisdom } from './services/aiService';
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
  const [showSettings, setShowSettings] = useState(false);
  
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    provider: 'gemini',
    ollamaHost: 'http://localhost:11434',
    ollamaModel: 'deepseek-r1:8b'
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const favorites = localStorage.getItem('bible_favorites');
    if (favorites) setSavedAnswers(JSON.parse(favorites).map((f: any) => ({ ...f, timestamp: new Date(f.timestamp) })));
    
    const version = localStorage.getItem('bible_version');
    if (version) setBibleVersion(version as BibleVersion);
    
    const isDark = localStorage.getItem('bible_dark_mode');
    if (isDark === 'true') setDarkMode(true);

    const settings = localStorage.getItem('bible_ai_settings');
    if (settings) setAiSettings(JSON.parse(settings));
  }, []);

  useEffect(() => localStorage.setItem('bible_favorites', JSON.stringify(savedAnswers)), [savedAnswers]);
  useEffect(() => localStorage.setItem('bible_version', bibleVersion), [bibleVersion]);
  useEffect(() => localStorage.setItem('bible_dark_mode', darkMode.toString()), [darkMode]);
  useEffect(() => localStorage.setItem('bible_ai_settings', JSON.stringify(aiSettings)), [aiSettings]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => { if (messages.length > 1 || isLoading) scrollToBottom(); }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    setLastError(null);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await getBibleWisdom(userMsg.content, bibleVersion, aiSettings);
      if (result.error) throw new Error(result.error);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        metadata: { ...result, version: bibleVersion }
      }]);
    } catch (error: any) {
      setLastError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (message: Message) => {
    if (!message.metadata) return;
    const exists = savedAnswers.some(s => s.id === message.id);
    if (exists) {
      setSavedAnswers(prev => prev.filter(s => s.id !== message.id));
    } else {
      const userMsg = messages.find((m, i) => messages[i+1]?.id === message.id);
      setSavedAnswers(prev => [{
        id: message.id,
        question: userMsg?.content || "Wisdom",
        answer: message.content,
        ...message.metadata!,
        version: message.metadata!.version || bibleVersion,
        timestamp: new Date()
      }, ...prev]);
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      <header className={`flex-shrink-0 z-50 glass h-16 flex items-center px-4 md:px-6 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-book-bible"></i>
            </div>
            <div className="hidden xs:block">
              <h1 className="font-serif text-lg font-bold">BibleWisdom</h1>
              <p className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold">
                {aiSettings.provider === 'ollama' ? 'Local DeepSeek' : 'Cloud Gemini'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <i className="fa-solid fa-gear"></i>
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-500'}`}>
              <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button onClick={() => setShowFavorites(true)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${darkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-600 border border-slate-100 shadow-sm'}`}>
              <i className="fa-solid fa-bookmark mr-2"></i>Saved
            </button>
          </div>
        </div>
      </header>

      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-10 pb-6">
        <div className="max-w-4xl mx-auto">
          {messages.map(msg => <ChatMessage key={msg.id} message={msg} onSave={toggleFavorite} isSaved={savedAnswers.some(s => s.id === msg.id)} isDarkMode={darkMode} />)}
          {isLoading && <div className="animate-pulse mb-6 flex gap-2 items-center text-indigo-500 text-xs font-bold"><i className="fa-solid fa-spinner fa-spin"></i> Divine insights coming...</div>}
          {lastError && <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-xs mb-6 border border-rose-100"><i className="fa-solid fa-circle-exclamation mr-2"></i>{lastError}</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className={`p-4 border-t ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Translation</span>
             <select value={bibleVersion} onChange={(e) => setBibleVersion(e.target.value as BibleVersion)} className={`text-[10px] font-bold p-1 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
               {BIBLE_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
             </select>
          </div>
          <form onSubmit={handleSend} className="relative">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter your spiritual query..." className={`w-full py-4 pl-6 pr-14 rounded-2xl outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border border-slate-200 focus:border-indigo-400'}`} />
            <button type="submit" className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"><i className="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-xl font-bold">AI Settings</h2>
              <button onClick={() => setShowSettings(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-3">Service Provider</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button onClick={() => setAiSettings({...aiSettings, provider: 'gemini'})} className={`py-2 rounded-lg text-xs font-bold transition-all ${aiSettings.provider === 'gemini' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}>Cloud Gemini</button>
                  <button onClick={() => setAiSettings({...aiSettings, provider: 'ollama'})} className={`py-2 rounded-lg text-xs font-bold transition-all ${aiSettings.provider === 'ollama' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}>Local Ollama</button>
                </div>
              </div>

              {aiSettings.provider === 'ollama' && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Ollama Endpoint</label>
                    <input value={aiSettings.ollamaHost} onChange={e => setAiSettings({...aiSettings, ollamaHost: e.target.value})} className={`w-full p-3 text-xs rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Model Name</label>
                    <input value={aiSettings.ollamaModel} onChange={e => setAiSettings({...aiSettings, ollamaModel: e.target.value})} className={`w-full p-3 text-xs rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 leading-relaxed">
                    <strong>Note:</strong> Set <code>OLLAMA_ORIGINS="*"</code> environment variable on your server to allow browser connections.
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200">Save & Close</button>
          </div>
        </div>
      )}

      {/* Favorites Modal (Simplified version for brevity) */}
      {showFavorites && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-3xl ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b flex justify-between">
              <h2 className="font-serif text-xl font-bold">Saved Wisdom</h2>
              <button onClick={() => setShowFavorites(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {savedAnswers.length === 0 ? <p className="text-center text-slate-400 py-10 text-sm">No saved verses yet.</p> : savedAnswers.map(s => (
                <div key={s.id} className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-indigo-500 uppercase">{s.topic}</span><button onClick={() => setSavedAnswers(p => p.filter(x => x.id !== s.id))} className="text-rose-500"><i className="fa-solid fa-trash text-xs"></i></button></div>
                  <p className="text-sm font-medium mb-1">{s.answer}</p>
                  <p className="text-[10px] text-slate-500 font-bold">— {s.reference} ({s.version})</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
