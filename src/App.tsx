/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, 
  Settings, 
  LogOut, 
  Key, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle,
  RefreshCcw,
  Sparkles,
  User,
  MessageCircle,
  X,
  Code,
  Send,
  Zap,
  Brain,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  supabase, 
  words3, 
  words8, 
  toKu, 
  MAX_ATTEMPTS 
} from './lib/constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Screen = 'auth' | 'home' | 'levels' | 'game' | 'result' | 'leaderboard';
type GameStatus = 'playing' | 'won' | 'lost';

interface UserScore {
  id: string;
  name: string;
  email: string;
  score: number;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [user, setUser] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [leaderboardFrom, setLeaderboardFrom] = useState<Screen>('levels');
  
  // Chat & Dev Panel State
  const [showChat, setShowChat] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Game Specific State
  const [level, setLevel] = useState<3 | 8>(3);
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [sessionScore, setSessionScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');

  // Auth/Startup & Session Listener
  useEffect(() => {
    let isMounted = true;

    const checkSessionAndSubscribe = async () => {
      // 1. Initial Check
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else if (isMounted) {
        setLoading(false);
      }

      // 2. Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!isMounted) return;
        
        if (session) {
          await fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setScreen('auth');
          setLoading(false);
        }
      });

      return subscription;
    };

    const fetchUserProfile = async (userId: string, email: string) => {
      try {
        const { data, error } = await supabase
          .from('kurd')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // Better than .single() to avoid 406 error if not found
        
        if (isMounted) {
          if (data) {
            setUser({
              id: userId,
              email: email,
              name: data.name,
              score: data.score
            });
            setScreen('home');
          } else {
            // Profile missing but auth session exists - should probably go to auth or profile creation
            // For now, if no profile, we stay at auth (or redirect to auth)
            setUser(null);
            setScreen('auth');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        if (isMounted) setLoading(false);
      }
    };

    const subscriptionPromise = checkSessionAndSubscribe();

    return () => {
      isMounted = false;
      subscriptionPromise.then(sub => sub.unsubscribe());
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setScreen('auth');
    setShowSettings(false);
  };

  const startGame = (l: 3 | 8) => {
    setLevel(l);
    const list = l === 3 ? words3 : words8;
    const randomWord = list[Math.floor(Math.random() * list.length)];
    setTargetWord(randomWord);
    setGuesses([]);
    setCurrentGuess('');
    setSessionScore(0);
    setGameStatus('playing');
    setScreen('game');
  };

  const submitGuess = useCallback(async () => {
    if (gameStatus !== 'playing' || currentGuess.length !== level) return;

    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');

    // Scoring logic
    const targetArr = targetWord.split('');
    const guessArr = currentGuess.split('');
    let pointsThisTurn = 0;
    
    const tempTarget = [...targetArr];
    const matchStates = Array(level).fill('absent');

    for (let i = 0; i < level; i++) {
      if (guessArr[i] === targetArr[i]) {
        matchStates[i] = 'correct';
        pointsThisTurn += 2;
        tempTarget[i] = '';
      }
    }

    for (let i = 0; i < level; i++) {
      if (matchStates[i] === 'absent') {
        const foundIdx = tempTarget.indexOf(guessArr[i]);
        if (foundIdx !== -1) {
          matchStates[i] = 'present';
          pointsThisTurn += 1;
          tempTarget[foundIdx] = '';
        }
      }
    }

    setSessionScore(prev => prev + pointsThisTurn);

    if (currentGuess === targetWord) {
      setGameStatus('won');
      await finishGame(true, sessionScore + pointsThisTurn);
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameStatus('lost');
      await finishGame(false, sessionScore + pointsThisTurn);
    }
  }, [currentGuess, targetWord, level, guesses, gameStatus, sessionScore]);

  const finishGame = async (won: boolean, finalScore: number) => {
    if (user) {
      const newTotalScore = user.score + finalScore;
      setUser(prev => prev ? { ...prev, score: newTotalScore } : null);
      
      await supabase
        .from('kurd')
        .upsert({ 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          score: newTotalScore 
        });
    }
    setTimeout(() => setScreen('result'), 1000);
  };

  const backToLevels = () => setScreen('home');

  const openLeaderboard = () => {
    // Only set the origin if we're not already in the leaderboard
    if (screen !== 'leaderboard') {
      setLeaderboardFrom(screen);
    }
    setScreen('leaderboard');
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const newMessages = [...chatMessages, { role: 'user', content: chatInput } as Message];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: chatInput,
          history: chatMessages.map(m => ({ 
            role: m.role === 'user' ? 'user' : 'model', 
            parts: [{ text: m.content }] 
          }))
        })
      });
      const data = await resp.json();
      setChatMessages([...newMessages, { role: 'model', content: data.text }]);
    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'model', content: 'ببوورە لە ئێستادا ناتوانم وەڵام بدەمەوە.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-game-bg">
        <RefreshCcw className="w-12 h-12 text-game-gold animate-spin" />
        <p className="mt-4 text-game-gold font-bold font-rubik">خەریکە بار دەبێت...</p>
      </div>
    );
  }

  return (
    <div className="custom-gradient-bg min-h-screen pb-10 overflow-x-hidden font-cairo">
      <header className="fixed top-0 inset-x-0 h-20 bg-[#0A0B10]/80 border-b border-white/5 flex items-center justify-center z-50 backdrop-blur-md">
        <div className="max-w-xl w-full px-6 flex items-center justify-between">
          {/* Right Side: Settings & Leaderboard (Matches Screenshot) */}
          <div className="flex items-center gap-3 order-2">
            {user && (
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-gray-500 ml-2">{user.email.split('@')[0]}</span>
              </div>
            )}
            <button 
              onClick={openLeaderboard}
              className="px-4 py-2 bg-[#1A1B23] border border-game-gold/30 text-game-gold rounded-xl text-xs font-black flex items-center gap-2 hover:bg-game-gold/10 transition-colors"
            >
              بەرزترین <Trophy className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2.5 bg-game-surface2 border border-white/10 rounded-xl text-gray-400 hover:text-game-gold transition-colors relative"
            >
              <Settings className="w-5 h-5" />
              {user && showSettings && (
                <AnimatePresence>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-14 left-0 bg-game-surface border border-white/5 rounded-xl p-2 z-[100] min-w-[200px] shadow-2xl text-right"
                  >
                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                      <p className="text-[10px] text-game-text2 font-bold uppercase tracking-widest">یاریزان</p>
                      <p className="text-sm font-black text-game-text truncate">{user.name}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const sharedUrl = 'https://ais-pre-xty4d6lv7uqb7hsl7agdkg-377099031036.europe-west2.run.app';
                        navigator.clipboard.writeText(sharedUrl);
                        alert('لینکەکە کۆپی کرا! 🔗');
                        setShowSettings(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-game-gold hover:bg-game-gold/5 rounded-lg transition-colors border-b border-white/5 mb-1"
                    >
                      <Share2 className="w-4 h-4 ml-2" />
                      کۆپیکردنی لینکی یاری
                    </button>
                    <button 
                      onClick={async () => {
                        const p = prompt('پاسوەردی نوێت بنوسە (کەمی ٦ پیت):');
                        if (p && p.length >= 6) {
                          await supabase.auth.updateUser({ password: p });
                          alert('پاسوەردەکەت گۆڕڕدرا');
                        }
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Key className="w-4 h-4 ml-2" />
                      پاسوەردی نوێ
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-game-red hover:bg-game-red/5 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4 ml-2" />
                      چوونەدەرەوە
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}
            </button>
          </div>

          {/* Left Side: Logo (Matches Screenshot) */}
          <div className="flex flex-col items-start order-1">
            <h1 className="text-3xl font-black text-game-gold tracking-tight font-rubik leading-none">وشە</h1>
            <span className="text-[10px] text-game-text2 font-bold mt-1 tracking-[1px]">یاری کوردی</span>
          </div>
        </div>
      </header>

      <main className="pt-28 px-6 max-w-lg mx-auto relative z-10 min-h-[calc(100vh-100px)]">
        <AnimatePresence mode="wait">
          {screen === 'auth' && (
            <AuthScreen 
              onSuccess={(u) => {
                setUser(u);
                setScreen('home');
              }} 
            />
          )}

          {screen === 'home' && (
            <HomeScreen 
              onStartWords={() => setScreen('levels')} 
              onOpenLB={openLeaderboard}
            />
          )}

          {screen === 'levels' && (
            <LevelsScreen 
              onSelect={startGame} 
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'game' && (
            <GameScreen 
              level={level}
              targetWord={targetWord}
              guesses={guesses}
              currentGuess={currentGuess}
              setCurrentGuess={setCurrentGuess}
              onSubmit={submitGuess}
              sessionScore={sessionScore}
              playerName={user?.name || ''}
              onQuit={backToLevels}
            />
          )}

          {screen === 'result' && (
            <ResultScreen 
              status={gameStatus}
              targetWord={targetWord}
              attempts={guesses.length}
              sessionScore={sessionScore}
              totalScore={user?.score || 0}
              onRestart={backToLevels}
              onLB={openLeaderboard}
            />
          )}

          {screen === 'leaderboard' && (
            <LeaderboardScreen 
              onBack={() => setScreen(leaderboardFrom)}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Chat Button (Left Side per screenshot) */}
      {user && (
        <motion.button
          id="chat-toggle"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setShowChat(!showChat)}
          className="fixed bottom-6 left-6 w-16 h-16 bg-gradient-to-br from-[#7C5CFF] to-[#633DFF] rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(124,92,255,0.4)] z-[200] active:scale-95 transition-all"
        >
          {showChat ? <X className="w-7 h-7 text-white" /> : <MessageCircle className="w-8 h-8 text-white" />}
        </motion.button>
      )}


      {/* Chat Window */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            id="chat-window"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-[320px] h-[450px] bg-game-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col z-[200] overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 bg-game-surface2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-game-gold/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-game-gold" />
              </div>
              <div>
                <h3 className="text-sm font-black text-game-text">سان</h3>
                <span className="text-[9px] text-game-green font-bold">لێرەم بۆ یارمەتیت</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {chatMessages.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-xs text-game-text2">سڵاو! هەر پرسیارێکی زمانەوانێت هەیە لە من بپرسە.</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed",
                    m.role === 'user' ? "bg-game-surface2 text-game-text border border-white/5 rounded-br-none" : "bg-game-gold/10 text-game-gold border border-game-gold/20 rounded-bl-none font-bold"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-end">
                  <div className="bg-game-gold/5 p-3 rounded-2xl animate-pulse">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-game-gold rounded-full" />
                      <div className="w-1.5 h-1.5 bg-game-gold rounded-full" />
                      <div className="w-1.5 h-1.5 bg-game-gold rounded-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-game-surface2">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="شتێک بنووسە..."
                  className="flex-1 bg-game-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-game-text outline-none focus:border-game-gold/50 transition-all font-bold"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button 
                  onClick={sendMessage}
                  className="w-10 h-10 bg-game-gold text-game-bg rounded-xl flex items-center justify-center active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Panel Overlay */}
      <AnimatePresence>
        {showDevPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-game-surface border border-game-cyan/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(56,217,245,0.2)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-game-cyan flex items-center gap-2">
                  <Code className="w-6 h-6" />
                  بەشی گەشەپێدەر
                </h3>
                <button onClick={() => setShowDevPanel(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => {
                    setSessionScore(prev => prev + 100);
                  }}
                  className="w-full py-4 bg-game-cyan/10 border border-game-cyan/20 text-game-cyan font-black rounded-xl hover:bg-game-cyan/20 transition-all flex items-center justify-between px-6"
                >
                  <span>زیادکردنی ١٠٠ خاڵ</span>
                  <Zap className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => {
                    if (screen === 'game') {
                      setCurrentGuess(targetWord);
                      setTimeout(() => submitGuess(), 100);
                    } else {
                      alert('تەنها لە کاتی یارییەکە دەتوانیت ئەمە بکەیت');
                    }
                  }}
                  className="w-full py-4 bg-game-green/10 border border-game-green/20 text-game-green font-black rounded-xl hover:bg-game-green/20 transition-all flex items-center justify-between px-6"
                >
                  <span>بردنەوەی یارییەکە (Auto Win)</span>
                  <CheckCircle2 className="w-5 h-5" />
                </button>

                <button 
                  onClick={async () => {
                    if (user) {
                      await supabase.from('kurd').update({ score: 0 }).eq('id', user.id);
                      setUser({ ...user, score: 0 });
                      alert('خاڵەکانت سفر کرانەوە');
                    }
                  }}
                  className="w-full py-4 bg-game-red/10 border border-game-red/20 text-game-red font-black rounded-xl hover:bg-game-red/20 transition-all flex items-center justify-between px-6"
                >
                  <span>سفرکردنەوەی هەموو خاڵەکان</span>
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>

              <p className="mt-8 text-[10px] text-gray-500 text-center font-bold">ئەم بەشە تەنها بۆ تاقیکردنەوەیە</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB COMPONENTS ---

function AuthScreen({ onSuccess }: { onSuccess: (u: UserScore) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        });
        if (authError) throw authError;
        
        if (authData.user) {
          await supabase.from('kurd').insert({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            score: 0
          });
          onSuccess({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            score: 0
          });
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });
        if (authError) throw authError;

        if (authData.user) {
          const { data } = await supabase
            .from('kurd')
            .select('*')
            .eq('id', authData.user.id)
            .single();
          
          onSuccess({
            id: authData.user.id,
            name: data?.name || authData.user.email?.split('@')[0] || 'یاریزان',
            email: authData.user.email || '',
            score: data?.score || 0
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'هەڵەیەک ڕوویدا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      id="auth-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center p-10 bg-gradient-to-br from-game-gold/10 to-game-cyan/10 rounded-[2rem] border border-game-gold/15 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-game-gold/5 blur-[80px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-game-cyan/5 blur-[80px] rounded-full" />
        
        <Sparkles className="w-16 h-16 mx-auto text-game-gold mb-4 animate-pulse" />
        <h2 className="text-5xl font-black bg-gradient-to-r from-game-gold via-white to-game-cyan bg-clip-text text-transparent mb-2 font-rubik">وشە</h2>
        <p className="text-gray-400 leading-relaxed max-w-xs mx-auto text-sm font-bold">پیتەکان بدۆزەوە، خاڵ کۆبکەرەوە و بێتە شێری زمانەکە! 🦁</p>
      </div>

      <div className="bg-game-surface border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="flex bg-game-surface2/50 rounded-xl p-1 mb-8">
          <button 
            onClick={() => setIsSignUp(false)}
            className={cn("flex-1 py-2.5 text-sm font-black rounded-lg transition-all", !isSignUp ? "bg-game-gold/20 text-game-gold shadow-lg" : "text-gray-500")}
          >
            چوونەژوورەوە
          </button>
          <button 
            onClick={() => setIsSignUp(true)}
            className={cn("flex-1 py-2.5 text-sm font-black rounded-lg transition-all", isSignUp ? "bg-game-gold/20 text-game-gold shadow-lg" : "text-gray-500")}
          >
            تۆمارکردن
          </button>
          <button 
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                const guestId = `guest_${Math.random().toString(36).substr(2, 9)}`;
                const guestName = `میوان_${Math.random().toString(36).substr(2, 4)}`;
                const guestUser = {
                  id: guestId,
                  name: guestName,
                  email: 'guest@wshyar.com',
                  score: 0
                };
                await supabase.from('kurd').insert(guestUser);
                onSuccess(guestUser);
              } catch (err) {
                setError('‌هەڵەیەک لە واستەدا ڕوویدا');
              } finally {
                setLoading(false);
              }
            }}
            className="flex-1 py-2.5 text-sm font-black rounded-lg transition-all text-game-cyan hover:bg-game-cyan/10"
          >
            واستە
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-game-text2 uppercase">ناو</label>
              <input 
                required
                type="text" 
                placeholder="ناوی یاریزان"
                className="w-full bg-game-surface2 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-game-gold/50 outline-none transition-all font-bold"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-game-text2 uppercase">ئیمەیڵ</label>
            <input 
              required
              type="email" 
              placeholder="email@example.com"
              dir="ltr"
              className="w-full bg-game-surface2 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-game-gold/50 outline-none transition-all text-right font-bold"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-game-text2 uppercase">پاسوەرد</label>
            <input 
              required
              type="password" 
              placeholder="کەمی ٦ پیت"
              dir="ltr"
              className="w-full bg-game-surface2 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-game-gold/50 outline-none transition-all text-right font-bold"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center text-xs text-game-red bg-game-red/10 p-4 rounded-xl border border-game-red/20"
            >
              <AlertCircle className="w-4 h-4 ml-2 flex-shrink-0" />
              <span className="font-bold">{error}</span>
            </motion.div>
          )}

          <button 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-game-gold to-game-gold2 text-game-bg font-black rounded-xl shadow-[0_4px_20px_rgba(245,200,66,0.3)] hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (isSignUp ? 'دروستکردنی ئەکاونت' : 'چوونەژوورەوە')}
            <ChevronLeft className="w-5 h-5 mr-1" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function HomeScreen({ onStartWords, onOpenLB }: { onStartWords: () => void, onOpenLB: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10 pb-20 mt-4"
    >
      {/* Hero Title */}
      <div className="text-center space-y-2 py-6">
        <h2 className="text-[100px] font-black text-white leading-none tracking-tighter drop-shadow-2xl font-rubik">وشە</h2>
        <p className="text-sm text-game-text2 font-bold tracking-[6px] uppercase opacity-60">یاری وشەی کوردی</p>
      </div>

      {/* Section Label (Matches Screenshot) */}
      <div className="relative py-4">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[1px] w-[70%] bg-gradient-to-l from-game-gold/40 to-transparent" />
        <span className="text-sm font-black text-game-gold bg-game-bg pr-4 relative z-10 block text-right">یاریەکان</span>
      </div>

      <div className="grid gap-6">
        {/* Main Game Card: Words (Structured like screenshot) */}
        <div className="bg-[#14151C]/90 border border-white/5 rounded-[3rem] p-4 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-game-gold/5 blur-[50px] rounded-full" />
          
          <div className="flex flex-row-reverse items-center justify-between p-4">
             {/* Right Content Column */}
             <div className="text-right space-y-4">
                <div>
                  <h3 className="text-5xl font-black text-game-gold font-rubik tracking-tight">وشەکان</h3>
                  <p className="text-sm text-game-text2 font-bold mt-2">پیتەکان بدۆزەوە — ٦ هەوڵ</p>
                </div>
                
                {/* Start Button Column (Bottom Left in visual) */}
                <div className="flex justify-end pt-2">
                   <button 
                    onClick={onStartWords}
                    className="px-8 py-2.5 bg-[#F5C842] text-game-bg text-xs font-black rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg"
                   >
                     دەستپێکردن
                   </button>
                </div>
             </div>

             {/* Left Icon (abc) Column */}
             <div className="w-24 h-24 bg-[#21222C] rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/10">
                <span className="text-3xl font-black text-gray-400 font-rubik opacity-80">abc</span>
             </div>
          </div>
        </div>

        {/* Coming Soon: Checkers */}
        <div className="bg-[#0F1015]/60 border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative opacity-40 grayscale">
          <div className="flex flex-row-reverse items-center justify-between">
             <div className="text-right">
                <h3 className="text-3xl font-black text-white font-rubik">دامە</h3>
                <p className="text-xs text-game-text2 font-bold mt-1">یاری دامەی کوردی</p>
             </div>
             <div className="relative">
                <div className="absolute -top-3 -right-3 px-3 py-1 bg-[#1A1B23] border border-white/10 rounded-lg text-[8px] font-black text-game-gold tracking-widest z-10">COMING SOON</div>
                <div className="w-16 h-16 bg-[#1A1B23] rounded-2xl flex items-center justify-center border border-white/5 opacity-50">
                   ♟️
                </div>
             </div>
          </div>
        </div>

        {/* Coming Soon: Trivia */}
        <div className="bg-[#0F1015]/60 border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative opacity-40 grayscale">
           <div className="flex flex-row-reverse items-center justify-between">
             <div className="text-right">
                <h3 className="text-3xl font-black text-white font-rubik">زانیاری</h3>
                <p className="text-xs text-game-text2 font-bold mt-1">تاقیکردنەوەی زانیاری</p>
             </div>
             <div className="relative">
                <div className="absolute -top-3 -right-3 px-3 py-1 bg-[#1A1B23] border border-white/10 rounded-lg text-[8px] font-black text-game-gold tracking-widest z-10">COMING SOON</div>
                <div className="w-16 h-16 bg-[#1A1B23] rounded-2xl flex items-center justify-center border border-white/5 opacity-50">
                   <Brain className="w-8 h-8 text-pink-400" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Footer LB Button (Matches Screenshot) */}
      <div className="pt-4">
        <button 
          onClick={onOpenLB}
          className="w-full py-5 bg-[#0A0B10]/60 border border-white/5 rounded-[2rem] flex items-center justify-center gap-4 text-xl font-black text-white active:scale-[0.98] transition-all shadow-xl"
        >
          بەرزترینەکان <span className="text-2xl">🏆</span>
        </button>
      </div>

      <div className="text-center opacity-10 pb-10">
        <Sparkles className="w-6 h-6 mx-auto text-game-gold" />
      </div>
    </motion.div>
  );
}

function LevelsScreen({ onSelect, onBack }: { onSelect: (l: 3 | 8) => void, onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      <div className="bg-game-surface border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-game-cyan/5 blur-[80px] rounded-full" />
        
        <h2 className="text-3xl font-black mb-1 font-rubik">ئاست هەڵبژێرە</h2>
        <p className="text-game-text2 text-sm mb-8 font-bold">هەر یەکێکیان هەڵبژێرە بۆ دەستپێکردن</p>
        
        <div className="grid gap-4">
          <button 
            onClick={() => onSelect(3)}
            className="flex items-center justify-between p-6 bg-game-surface2 border border-white/5 rounded-2xl hover:border-game-green/40 hover:bg-game-green/5 transition-all group relative overflow-hidden"
          >
            <div className="text-right relative z-10">
              <div className="text-2xl font-black group-hover:text-game-green transition-colors font-rubik">٣ پیت</div>
              <div className="text-[10px] text-gray-500 font-bold mt-1">🟡 ١ خاڵ &nbsp; 🟢 ٢ خاڵ</div>
            </div>
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="px-3 py-1 bg-game-green/10 text-game-green rounded-lg text-[10px] font-black uppercase tracking-wider">ئاسان</span>
              <motion.div whileHover={{ scale: 1.1 }} className="p-3 bg-game-green/10 rounded-xl">
                 <Zap className="w-5 h-5 text-game-green" />
              </motion.div>
            </div>
          </button>
          
          <button 
            onClick={() => onSelect(8)}
            className="flex items-center justify-between p-6 bg-game-surface2 border border-white/5 rounded-2xl hover:border-game-cyan/40 hover:bg-game-cyan/5 transition-all group relative overflow-hidden"
          >
            <div className="text-right relative z-10">
              <div className="text-2xl font-black group-hover:text-game-cyan transition-colors font-rubik">٨ پیت</div>
              <div className="text-[10px] text-gray-500 font-bold mt-1">🟡 ١ خاڵ &nbsp; 🟢 ٢ خاڵ</div>
            </div>
            <div className="flex flex-col items-center gap-1 z-10">
              <span className="px-3 py-1 bg-game-cyan/10 text-game-cyan rounded-lg text-[10px] font-black uppercase tracking-wider">قورس</span>
              <motion.div whileHover={{ scale: 1.1 }} className="p-3 bg-game-cyan/10 rounded-xl">
                 <Trophy className="w-5 h-5 text-game-cyan" />
              </motion.div>
            </div>
          </button>
        </div>
      </div>

      <button 
        onClick={onBack}
        className="w-full flex items-center justify-center gap-3 py-5 border border-white/5 bg-game-surface/50 text-game-text font-black rounded-2xl hover:bg-game-surface transition-all shadow-lg group"
      >
        <span>گەڕانەوە بۆ سەرەتا</span>
        <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
      </button>

      <div className="p-6 bg-game-surface2/30 border border-white/5 rounded-2xl">
        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">تێبینی: هەر پیتێک ڕەنگی سەوز بوو واتە لە شوێنی خۆیەتی، ڕەنگی زەرد واتە لە وشەکەدا هەیە بەڵام شوێنەکەی هەڵەیە.</p>
      </div>
    </motion.div>
  );
}

function GameScreen({ 
  level, targetWord, guesses, currentGuess, setCurrentGuess, onSubmit, sessionScore, playerName, onQuit 
}: { 
  level: number, targetWord: string, guesses: string[], currentGuess: string, setCurrentGuess: (s: string) => void, onSubmit: () => void, sessionScore: number, playerName: string, onQuit: () => void 
}) {
  return (
    <motion.div 
      id="game-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-game-surface border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-game-text2">
          <div className="w-2 h-2 rounded-full bg-game-green shadow-[0_0_10px_rgba(46,204,113,0.8)]" />
          {playerName}
        </div>
        <div className="bg-game-surface border border-game-gold/30 px-5 py-2.5 rounded-xl text-xs font-black text-game-gold shadow-[0_0_20px_rgba(245,200,66,0.1)] flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          خاڵ: <span className="mr-1 text-sm font-rubik">{toKu(sessionScore)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 items-center">
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
          const guess = guesses[rowIndex];
          const isCurrentRow = rowIndex === guesses.length;
          
          return (
            <div key={rowIndex} className="flex gap-2">
              {Array.from({ length: level }).map((__, colIndex) => {
                let letter = '';
                let status = 'idle';

                if (guess) {
                  letter = guess[colIndex];
                  if (guess[colIndex] === targetWord[colIndex]) {
                    status = 'correct';
                  } else if (targetWord.includes(guess[colIndex])) {
                    status = 'present';
                  } else {
                    status = 'absent';
                  }
                } else if (isCurrentRow) {
                  letter = currentGuess[colIndex] || '';
                }

                return (
                  <motion.div 
                    key={colIndex}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "w-12 h-12 flex items-center justify-center text-2xl font-black rounded-xl border-2 transition-all duration-500",
                      level === 8 && "w-9 h-9 text-lg",
                      status === 'idle' && (isCurrentRow && currentGuess[colIndex] ? "border-game-cyan/50 bg-game-surface2 scale-105" : "border-white/5 bg-game-surface2"),
                      status === 'correct' && "bg-game-green/20 border-game-green text-game-green shadow-[0_0_20px_rgba(46,204,113,0.4)] animate-[flip_0.5s_ease-in-out]",
                      status === 'present' && "bg-game-orange/20 border-game-orange text-game-orange shadow-[0_0_20px_rgba(243,156,18,0.4)] animate-[flip_0.5s_ease-in-out]",
                      status === 'absent' && "bg-white/5 border-white/5 text-game-muted opacity-50"
                    )}
                  >
                    {letter}
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="space-y-5 pt-8">
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="وشەکەت بنووسە"
            className="flex-1 bg-game-surface border-2 border-game-cyan/20 rounded-2xl px-6 py-4 text-3xl font-black text-center outline-none focus:border-game-cyan transition-all text-white placeholder:text-gray-700 placeholder:text-sm font-rubik"
            maxLength={level}
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            autoFocus
          />
          <button 
            onClick={onSubmit}
            className="px-10 bg-gradient-to-r from-game-cyan to-[#0099cc] text-game-bg font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-2 rounded-full transition-all duration-500", 
                i < guesses.length ? "bg-game-muted w-2" : (i === guesses.length ? "bg-game-gold w-8 shadow-[0_0_10px_rgba(245,200,66,0.6)]" : "bg-game-surface2 w-2")
              )} 
            />
          ))}
        </div>

        <button 
          onClick={onQuit}
          className="w-full flex items-center justify-center gap-2 py-4 border border-white/5 text-game-text2 font-bold rounded-2xl hover:text-white hover:bg-white/5 transition-all text-sm"
        >
          <LogOut className="w-4 h-4 ml-2" />
          جێهێشتنی یاری
        </button>
      </div>
    </motion.div>
  );
}

function ResultScreen({ 
  status, targetWord, attempts, sessionScore, totalScore, onRestart, onLB 
}: { 
  status: GameStatus, targetWord: string, attempts: number, sessionScore: number, totalScore: number, onRestart: () => void, onLB: () => void 
}) {
  const won = status === 'won';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="space-y-6"
    >
      <div className="bg-game-surface border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        {won && <div className="absolute inset-0 bg-game-green/5 animate-pulse" />}
        
        <div className="p-12 text-center space-y-4 relative z-10">
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="text-7xl block mb-4"
          >
            {won ? '🏆' : '💀'}
          </motion.span>
          <h2 className={cn("text-4xl font-black font-rubik", won ? "text-game-green" : "text-game-red")}>
            {won ? 'سەرکەوتوو بوویت!' : 'دۆڕایت زۆربەڕێز!'}
          </h2>
          <p className="text-game-text2 text-sm font-bold">
            {won ? 'تۆ شیاوی ئەم سەرکەوتنەیت' : 'پەراوێز مەبە، دووبارە تاقی بکەرەوە'}
          </p>
        </div>

        <div className="bg-game-surface2/50 p-8 space-y-10 relative z-10">
          <div className="text-center">
            <span className="text-[10px] text-gray-500 font-black tracking-widest uppercase block mb-4">وەڵامی ڕاست:</span>
            <div className="flex justify-center gap-3 flex-wrap">
              {targetWord.split('').map((l, i) => (
                <div key={i} className="w-12 h-12 flex items-center justify-center bg-game-gold/5 border-2 border-game-gold/30 text-game-gold font-black rounded-2xl text-2xl font-rubik shadow-lg">
                  {l}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-game-bg/80 border border-white/5 p-5 rounded-2xl text-center shadow-inner">
              <div className="text-3xl font-black text-white font-rubik">{toKu(attempts)}</div>
              <div className="text-[10px] font-black text-game-text2 tracking-tighter mt-1 uppercase">هەوڵ</div>
            </div>
            <div className="bg-game-bg/80 border border-game-gold/30 p-5 rounded-2xl text-center shadow-[0_0_20px_rgba(245,200,66,0.05)]">
              <div className="text-3xl font-black text-game-gold font-rubik">{toKu(sessionScore)}</div>
              <div className="text-[10px] font-black text-game-text2 tracking-tighter mt-1 uppercase">خاڵ</div>
            </div>
            <div className="bg-game-bg/80 border border-game-cyan/30 p-5 rounded-2xl text-center shadow-[0_0_20px_rgba(56,217,245,0.05)]">
              <div className="text-3xl font-black text-game-cyan font-rubik">{toKu(totalScore)}</div>
              <div className="text-[10px] font-black text-game-text2 tracking-tighter mt-1 uppercase">کۆی گشتی</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={onRestart}
              className="flex-1 py-5 bg-gradient-to-r from-game-gold to-game-gold2 text-game-bg font-black rounded-2xl shadow-[0_4px_20px_rgba(245,200,66,0.3)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <RefreshCcw className="w-5 h-5" />
              دووبارە
            </button>
            <button 
              onClick={onLB}
              className="flex-1 py-5 border border-white/10 bg-game-surface text-game-text font-black rounded-2xl hover:bg-game-bg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Trophy className="w-5 h-5 text-game-gold" />
              لیست
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLB = async () => {
      const { data: lbData } = await supabase
        .from('kurd')
        .select('name, score')
        .order('score', { ascending: false })
        .limit(30);
      
      if (lbData) setData(lbData);
      setLoading(false);
    };
    fetchLB();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <div className="bg-game-surface border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-40 h-40 bg-game-gold/5 blur-[80px] rounded-full" />
        
        <h2 className="text-3xl font-black mb-8 flex items-center gap-4 relative z-10 font-rubik">
          <Trophy className="w-8 h-8 text-game-gold drop-shadow-[0_0_10px_rgba(245,200,66,0.5)]" />
          شێرەکانی یاری وشە
        </h2>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 opacity-50">
               <RefreshCcw className="w-10 h-10 animate-spin text-game-gold mb-4" />
               <p className="font-bold">خەریکە بار دەبێت...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-20 text-game-text2 font-bold">هێشتا هیچ شێرێک نییە! 🦁</div>
          ) : (
            data.map((player, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-4 px-6 py-5 bg-game-surface2/50 border border-white/5 rounded-2xl transition-all hover:scale-[1.02]",
                  i === 0 && "border-game-gold/50 bg-game-gold/10 shadow-[0_0_25px_rgba(245,200,66,0.1)]",
                  i === 1 && "border-gray-400/30 bg-gray-400/5",
                  i === 2 && "border-orange-500/30 bg-orange-500/5"
                )}
              >
                <div className="w-10 text-center text-2xl font-black">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-game-text2 text-sm font-rubik">{toKu(i + 1)}</span>}
                </div>
                <div className="flex-1 font-black truncate text-game-text">{player.name}</div>
                <div className="text-xl font-black text-game-cyan font-rubik">{toKu(player.score)}</div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <button 
        onClick={onBack}
        className="w-full flex items-center justify-center gap-3 py-5 border border-white/5 bg-game-surface/50 text-game-text2 font-bold rounded-2xl hover:text-white hover:bg-game-surface transition-all group"
      >
        <span>گەڕانەوە</span>
        <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
      </button>
    </motion.div>
  );
}
