/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Settings, 
  Map as MapIcon, 
  Zap, 
  Clock, 
  Shield, 
  Trophy, 
  Radio, 
  ChevronRight,
  TrendingDown,
  Wind,
  MessageSquare
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface ChatMessage {
  id: number;
  user: string;
  text: string;
  timestamp: string;
  team: string;
}

interface TelemetryData {
  timestamp: number;
  raceTime: number;
  activeAero: string;
  fanPulse: {
    positive: number;
    excitement: number;
  };
  cars: {
    id: number;
    driver: string;
    speed: number;
    gear: number;
    rpm: number;
    tire: string;
    tireAge: number;
  }[];
}

// --- Components ---

const TechnicalCard = ({ title, icon: Icon, children, className = "" }: any) => (
  <div className={`bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-hidden relative group/card ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-red-600 transition-colors group-hover/card:text-red-500" />
        <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">{title}</h3>
      </div>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-zinc-700 animate-pulse"></div>
        <div className="w-1 h-1 bg-red-900/40"></div>
      </div>
    </div>
    {children}
  </div>
);

const FanPulseGauge = ({ excitement }: { excitement: number }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex items-end gap-1 h-12">
      {[...Array(12)].map((_, i) => (
        <motion.div 
          key={i}
          animate={{ height: `${20 + (Math.random() * (excitement/2))}px` }}
          className={`w-1 rounded-t-sm ${i > 8 ? 'bg-red-600' : 'bg-zinc-700'}`}
        />
      ))}
    </div>
    <div className="text-[10px] font-mono text-zinc-500 uppercase">Live Pulse: {excitement.toFixed(0)}%</div>
  </div>
);

const ChatPanel = ({ messages, onSendMessage }: { messages: ChatMessage[], onSendMessage: (txt: string) => void }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <TechnicalCard title="Team Radio (Live Chat)" icon={MessageSquare} className="h-[400px] flex flex-col">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide mb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="group/msg border-l border-zinc-800 pl-3">
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-black italic text-[#FF8700] uppercase">{msg.user}</span>
               <span className="text-[8px] font-mono text-zinc-600">{msg.timestamp}</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight font-mono opacity-80 group-hover/msg:opacity-100 transition-opacity">
              {msg.text}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="relative mt-auto pt-2 border-t border-zinc-900">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="COMM_LINK_ESTABLISHED..."
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-3 py-2 text-[10px] font-mono focus:outline-none focus:border-red-600 transition-colors"
        />
        <button type="submit" className="absolute right-2 top-[calc(50%+4px)] -translate-y-1/2 text-red-600 hover:text-red-500">
           <ChevronRight className="w-4 h-4" />
        </button>
      </form>
    </TechnicalCard>
  );
};

// --- Custom Hooks ---
function useF1Socket(onMessage: (msg: any) => void) {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    ws.current = socket;

    socket.onopen = () => {
      setStatus('open');
      reconnectCount.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    socket.onclose = () => {
      setStatus('closed');
      // Exponential backoff
      const timeout = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
      reconnectCount.current++;
      setTimeout(connect, timeout);
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, []);

  return { 
    send: (data: any) => ws.current?.readyState === WebSocket.OPEN && ws.current.send(JSON.stringify(data)),
    status 
  };
}

const FanEngagementCenter = ({ poll, quiz, quizResult, onVote, onAnswer, onReact }: any) => {
  return (
    <div className="space-y-4">
      {/* Reactions Bar */}
      <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
        {["🏎️", "🔥", "👏", "😱", "🏁"].map(emoji => (
          <button 
            key={emoji}
            onClick={() => onReact(emoji)}
            className="hover:scale-125 transition-transform active:scale-95 text-lg filter drop-shadow-sm"
          >
            {emoji}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {poll && (
          <motion.div 
            key="poll"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <TechnicalCard title="Live Fan Poll" icon={MessageSquare} className="border-red-600/30">
              <p className="text-[11px] font-bold mb-3">{poll.question}</p>
              <div className="space-y-2">
                {poll.options.map((opt: string, i: number) => {
                  const totalVotes = Object.values(poll.votes as Record<string, number>).reduce((a, b) => a + b, 0) || 1;
                  const percent = ((poll.votes[i] || 0) / totalVotes) * 100;
                  return (
                    <button 
                      key={opt}
                      onClick={() => onVote(poll.id, i)}
                      className="w-full relative bg-zinc-900 border border-zinc-800 p-2 rounded group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-red-600/10 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                      <div className="relative flex justify-between items-center text-[10px] font-mono">
                        <span className="group-hover:text-white transition-colors">{opt}</span>
                        <span className="text-zinc-500">{percent.toFixed(0)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TechnicalCard>
          </motion.div>
        )}

        {quiz && (
          <motion.div 
            key="quiz"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <TechnicalCard title="Sprint Quiz" icon={Zap} className="border-yellow-600/30">
              <p className="text-[11px] font-bold mb-3">{quiz.question}</p>
              {quizResult ? (
                <motion.div 
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className={`p-4 rounded text-center border ${quizResult.correct ? 'bg-green-600/20 border-green-500/30 text-green-500' : 'bg-red-600/20 border-red-500/30 text-red-500'}`}
                >
                  <Trophy className={`w-8 h-8 mx-auto mb-2 ${quizResult.correct ? 'text-yellow-500' : 'text-zinc-600'}`} />
                  <p className="text-sm font-black uppercase mb-1 leading-none">{quizResult.correct ? 'CORRECT!' : 'INCORRECT'}</p>
                  <p className="text-[10px] font-mono opacity-80">{quizResult.correct ? `+${quizResult.reward} GP EARNED` : 'DATA_INCORRECT: RECALCULATING...'}</p>
                  {quizResult.correct && (
                    <motion.div 
                      animate={{ y: [0, -5, 0] }} 
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="mt-2 text-[8px] font-black uppercase tracking-widest text-yellow-500"
                    >
                      Win Streak Continued 🔥
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {quiz.options.map((opt: string, i: number) => (
                    <button 
                      key={opt}
                      onClick={() => onAnswer(quiz.id, i)}
                      className="bg-zinc-900 border border-zinc-800 p-2 rounded text-[10px] font-mono hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </TechnicalCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiCommentary, setAiCommentary] = useState<string>('');
  const [gripPoints, setGripPoints] = useState(0);
  const [userId, setUserId] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'LIVE' | 'OFFLINE' | 'PRACTICE'>('OFFLINE');
  const [activeDriverId, setActiveDriverId] = useState(4); // Lando by default
  
  const [syncDelay, setSyncDelay] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'strategy' | 'season'>('feed');
  const [seasonBoard, setSeasonBoard] = useState<any[]>([]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [predictionOutcome, setPredictionOutcome] = useState<string | null>(null);
  
  // Engagement State
  const [poll, setPoll] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [reactions, setReactions] = useState<{ id: number, emoji: string }[]>([]);
  const [battleAlert, setBattleAlert] = useState<string | null>(null);
  const [level, setLevel] = useState(1);

  const { send, status: socketStatus } = useF1Socket((msg) => {
    if (msg.type === 'INIT') {
      setUserId(msg.data.userId);
      setChatMessages(msg.data.chatHistory || []);
      if (msg.data.aiCommentary) setAiCommentary(msg.data.aiCommentary);
      if (msg.data.sessionStatus) setSessionStatus(msg.data.sessionStatus);
      if (msg.data.gripPoints) setGripPoints(msg.data.gripPoints);
      if (msg.data.level) setLevel(msg.data.level);
      if (msg.data.activePoll) setPoll(msg.data.activePoll);
      if (msg.data.activeQuiz) setQuiz(msg.data.activeQuiz);
      if (msg.data.seasonLeaderboard) setSeasonBoard(msg.data.seasonLeaderboard);
    }
    if (msg.type === 'ACHIEVEMENT_UNLOCKED') {
      setShowAchievement(msg.achievements[msg.achievements.length - 1]);
      setTimeout(() => setShowAchievement(null), 5000);
    }
    if (msg.type === 'REACTION_BURST') {
      const id = Date.now();
      setReactions(prev => [...prev.slice(-15), { id, emoji: msg.emoji }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
    }
    if (msg.type === 'NEW_POLL') {
      setPoll(msg.poll);
      setBattleAlert("NEW_FAN_POLL_ACTIVE");
      setTimeout(() => setBattleAlert(null), 3000);
    }
    if (msg.type === 'POLL_UPDATE') {
      setPoll((prev: any) => prev ? { ...prev, votes: msg.votes } : null);
    }
    if (msg.type === 'END_POLL') setPoll(null);
    if (msg.type === 'NEW_QUIZ') {
      setQuiz(msg.quiz);
      setQuizResult(null);
      setBattleAlert("LIVE_QUIZ_INCOMING");
      setTimeout(() => setBattleAlert(null), 3000);
    }
    if (msg.type === 'QUIZ_RESULT') {
      setQuizResult(msg);
      if (msg.reward) setGripPoints(msg.totalGrip);
    }
    if (msg.type === 'END_QUIZ') {
      setQuiz(null);
      setQuizResult(null);
    }
    if (msg.type === 'TELEMETRY') {
      setTelemetry(msg.data);
      if (msg.data.sessionStatus) setSessionStatus(msg.data.sessionStatus);

      setHistory(prev => {
        const carFocus = msg.data.cars.find((c: any) => c.id === activeDriverId) || msg.data.cars[0];
        const newHistory = [...prev, {
          raceTime: msg.data.raceTime,
          speed: carFocus.speed,
          rpm: carFocus.rpm
        }];
        return newHistory.slice(-60); // Longer history for smoother curves
      });
    }
    if (msg.type === 'NEW_MESSAGE') {
      setChatMessages(prev => [...prev.slice(-49), msg.data]);
    }
    if (msg.type === 'AI_COMMENTARY') {
      setAiCommentary(msg.data);
    }
    if (msg.type === 'GP_UPDATE') {
      setGripPoints(msg.data);
    }
  });

  const sendFanVote = (direction: 'up' | 'down') => {
    send({ type: 'FAN_VOTE', direction, userId });
    setPredictionOutcome(direction === 'up' ? "VOTE_CAST: PUSH_LIMITS" : "VOTE_CAST: CONSERVE");
    setTimeout(() => setPredictionOutcome(null), 2000);
  };

  const onSendMessage = (text: string) => {
    send({ 
      type: 'SEND_MESSAGE', 
      text, 
      user: userId, 
      team: 'McLaren',
      userId
    });
  };

  const adjustSync = async (delta: number) => {
    const newDelay = Math.max(0, syncDelay + delta);
    setSyncDelay(newDelay);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay: newDelay })
      });
    } catch (e) {
      console.error("Sync update failed");
    }
  };

  const calibrateSync = () => {
    setIsSyncing(true);
    // Audio fingerprinting simulation
    setTimeout(() => {
      adjustSync(2); // Simulating found drift
      setIsSyncing(false);
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    send({ type: 'LIVE_REACTION', emoji });
  };

  const onPollVote = (pollId: string, optionIndex: number) => {
    send({ type: 'POLL_VOTE', pollId, optionIndex });
  };

  const onQuizAnswer = (quizId: string, answerIndex: number) => {
    send({ type: 'QUIZ_ANSWER', quizId, answerIndex });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600/30">
      {/* Achievement Unlock Toast */}
      <AnimatePresence>
        {showAchievement && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] bg-zinc-900 border-2 border-yellow-500 p-4 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-black">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-yellow-500 uppercase font-black">Achievement Unlocked</p>
              <p className="text-sm font-bold text-white">{showAchievement.replace(/_/g, ' ')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction Burst Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ y: '100vh', x: `${20 + Math.random() * 60}vw`, opacity: 0, scale: 0.5 }}
              animate={{ y: '-10vh', opacity: 1, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: "easeOut" }}
              className="absolute text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Battle Alert Overlay */}
      <AnimatePresence>
        {battleAlert && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none"
          >
            <div className="bg-red-600 text-white px-12 py-4 font-black italic text-4xl transform -skew-x-12 shadow-[0_0_50px_rgba(220,38,38,0.5)] border-y-4 border-white">
              {battleAlert}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Background Glow */}
      <div 
        className="fixed inset-0 pointer-events-none transition-colors duration-1000 z-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(239, 68, 68, ${(telemetry?.fanPulse.excitement || 0) / 400}) 0%, rgba(0, 0, 0, 0) 70%)`
        }}
      />

      {/* HUD Header */}
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 p-1 font-black italic tracking-tighter text-xl transform -skew-x-12 px-3 hover:bg-white hover:text-red-600 transition-colors cursor-default">
              F1 PULSE
            </div>
            <div className="hidden md:flex gap-6 text-[11px] font-mono tracking-widest text-zinc-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-red-600"/> MONACO GP</span>
              <span className="flex items-center gap-1">
                <Radio className={`w-3 h-3 ${sessionStatus === 'LIVE' ? 'text-red-600 animate-pulse' : 'text-zinc-700'}`}/> 
                {sessionStatus === 'LIVE' ? 'LIVE_DATA_STREAM' : 'REPLAY_SIM_ACTIVE'}
              </span>
              <span className="flex items-center gap-1">
                <Shield className={`w-3 h-3 ${socketStatus === 'open' ? 'text-green-600' : 'text-red-600'}`}/>
                {socketStatus === 'open' ? 'ENCRYPTED' : 'RECONNECTING...'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                  <Trophy className="w-2.5 h-2.5 text-yellow-500" />
                  <span className="text-[10px] font-mono text-zinc-300 uppercase font-black">
                    {gripPoints > 50000 ? 'ELITE' : gripPoints > 10000 ? 'PRO' : 'ROOKIE'}
                  </span>
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] font-mono text-zinc-500 uppercase leading-none">Level {Math.floor(gripPoints/5000) + 1}</span>
                   <div className="w-16 h-1 mt-1 bg-zinc-800 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(gripPoints % 5000) / 50}%` }}
                        className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]"
                     ></motion.div>
                   </div>
                </div>
              </div>
              <span className="text-xl font-black text-[#FF8700] italic tabular-nums leading-tight">{gripPoints.toLocaleString()} <span className="text-[10px]">GP</span></span>
            </div>
            <FanPulseGauge excitement={telemetry?.fanPulse.excitement || 0} />
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
               <button 
                  onClick={() => adjustSync(-1)} 
                  className="px-2 py-1 text-[10px] hover:bg-zinc-800 text-zinc-400 border-r border-zinc-800"
               >-</button>
               <button 
                onClick={calibrateSync}
                className={`flex items-center gap-2 px-3 py-1.5 ${isSyncing ? 'text-red-500 animate-pulse' : 'text-zinc-400'} text-[10px] font-mono uppercase tracking-widest transition-all hover:text-white`}
              >
                <Zap className="w-3 h-3" />
                {isSyncing ? 'Autosync...' : `Sync: -${syncDelay}s`}
              </button>
              <button 
                  onClick={() => adjustSync(1)} 
                  className="px-2 py-1 text-[10px] hover:bg-zinc-800 text-zinc-400 border-l border-zinc-800"
               >+</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        <AnimatePresence>
          {aiCommentary && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="lg:col-span-12 bg-red-600/10 border border-red-600/50 p-3 rounded-sm flex items-center gap-4 overflow-hidden"
            >
              <div className="bg-red-600 p-1 flex items-center justify-center animate-pulse">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-mono font-bold text-red-500 block uppercase">Race Director Alert</span>
                <p className="text-xs font-mono text-zinc-100 italic">"{aiCommentary}"</p>
              </div>
              <button onClick={() => setAiCommentary('')} className="text-zinc-500 hover:text-white">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Left Column: Interactive Telemetry */}
        <div className="lg:col-span-3 space-y-6">
          <TechnicalCard title={`${telemetry?.cars.find(c => c.id === activeDriverId)?.driver || 'CAR'} Telemetry`} icon={Activity}>
            <div className="flex gap-2 mb-4">
               {[4, 1].map(id => (
                 <button 
                  key={id}
                  onClick={() => {
                    setActiveDriverId(id);
                    setHistory([]); // reset history on switch for focus
                  }}
                  className={`px-3 py-1 rounded text-[9px] font-mono transition-all ${activeDriverId === id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                 >
                   {id === 4 ? 'NOR_04' : 'VER_01'}
                 </button>
               ))}
            </div>
            <div className="h-40 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="raceTime" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '10px' }}
                    labelStyle={{ color: '#71717a' }}
                  />
                  <Area 
                    type="basis" 
                    dataKey="speed" 
                    stroke="#ef4444" 
                    fillOpacity={1} 
                    fill="url(#colorSpeed)" 
                    isAnimationActive={false} 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
               <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-mono">CURRENT VELOCITY</span>
                    <span className="text-2xl font-black italic tabular-nums">
                      {telemetry?.cars.find(c => c.id === activeDriverId)?.speed.toFixed(1)} <span className="text-xs text-zinc-600">KM/H</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 font-mono">REV_LIMITER</span>
                    <div className="text-lg font-bold font-mono text-zinc-300">
                      {telemetry?.cars.find(c => c.id === activeDriverId)?.rpm.toLocaleString()}
                    </div>
                  </div>
               </div>
               
               {/* Shift Light Indicator */}
               <div className="flex gap-1 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden mt-1">
                  {[...Array(10)].map((_, i) => {
                    const rpm = telemetry?.cars.find(c => c.id === activeDriverId)?.rpm || 0;
                    const percent = rpm / 12000;
                    const threshold = i / 10;
                    return (
                      <div 
                        key={i} 
                        className={`flex-1 transition-colors duration-200 ${percent > threshold ? (i > 7 ? 'bg-red-600' : 'bg-green-500') : 'bg-zinc-800'}`}
                      />
                    );
                  })}
               </div>
            </div>
          </TechnicalCard>
          
          <TechnicalCard title="Fan Sentiment Meter" icon={Activity}>
             <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end mb-2 font-mono">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase">Team Norris</span>
                    <span className="text-sm font-black text-[#FF8700] uppercase tracking-tighter">McLaren Pulse</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase">Team Verstappen</span>
                    <span className="text-sm font-black text-[#1e41ff] uppercase tracking-tighter">Red Bull Pulse</span>
                  </div>
                </div>
                
                <div className="h-6 w-full flex rounded-sm overflow-hidden border border-zinc-800 shadow-inner">
                  <motion.div 
                    initial={{ width: '50%' }}
                    animate={{ width: `${60 + Math.sin(Date.now()/5000) * 10}%` }}
                    className="h-full bg-[#FF8700] relative group/sent"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20"></div>
                  </motion.div>
                  <motion.div 
                    initial={{ width: '50%' }}
                    animate={{ width: `${40 - Math.sin(Date.now()/5000) * 10}%` }}
                    className="h-full bg-[#1e41ff]"
                  ></motion.div>
                </div>
                
                <div className="flex justify-between text-[8px] font-mono text-zinc-600 uppercase tracking-widest mt-1">
                  <span>62% Support</span>
                  <span>38% Support</span>
                </div>
             </div>
          </TechnicalCard>

          <TechnicalCard title="Active Aero State" icon={Wind}>
             <div className="flex flex-col items-center py-4">
               <div className="relative">
                 <motion.div 
                    animate={{ rotate: telemetry?.activeAero === 'Low Drag' ? 8 : 0 }}
                    className={`w-32 h-16 border-2 rounded-t-3xl transition-all duration-500 ${telemetry?.activeAero === 'Low Drag' ? 'border-green-500' : 'border-red-500'}`}
                 />
                 <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-tighter">
                   {telemetry?.activeAero}
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4 w-full mt-6 font-mono text-[10px]">
                 <div className="bg-zinc-900 p-2 rounded flex justify-between border-l-2 border-red-600">
                   <span className="text-zinc-500">LIFT</span>
                   <span className="font-bold">4.2kN</span>
                 </div>
                 <div className="bg-zinc-900 p-2 rounded flex justify-between border-l-2 border-green-600">
                   <span className="text-zinc-500">DRAG</span>
                   <span className="font-bold">0.8kN</span>
                 </div>
               </div>
             </div>
          </TechnicalCard>

          <TechnicalCard title="Pit Wall Strategy Room" icon={Trophy}>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Real-Time Prediction</span>
                <span className="bg-red-600/20 text-red-500 text-[8px] font-bold px-2 py-0.5 rounded-full border border-red-600/30">LEVEL {Math.floor(gripPoints/5000) + 1}</span>
              </div>
              
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 relative group/bet overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#FF8700] flex items-center justify-center font-black text-xs text-black">4</div>
                  <div className="text-xs font-bold italic tracking-tight">SHOULD NOR PUSH NOW?</div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => sendFanVote('up')}
                    className="flex-1 py-3 rounded text-[10px] bg-red-600 font-bold hover:bg-white hover:text-red-600 transition-all uppercase flex flex-col items-center gap-1 shadow-lg shadow-red-600/20"
                  >
                    <span>YES (Push)</span>
                    <span className="text-[8px] opacity-60">+50 GP</span>
                  </button>
                  <button 
                    onClick={() => sendFanVote('down')}
                    className="flex-1 py-3 rounded text-[10px] bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 transition-all uppercase flex flex-col items-center gap-1"
                  >
                    <span>NO (Save)</span>
                    <span className="text-[8px] opacity-60">+20 GP</span>
                  </button>
                </div>

                <AnimatePresence>
                  {predictionOutcome && (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center text-[10px] font-bold italic z-10"
                    >
                      <Zap className="w-5 h-5 mb-1" />
                      {predictionOutcome}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-900 border-dashed">
                 <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500 uppercase">Current Win Streak</span>
                    <div className="flex gap-1">
                       {[1,1,1,0,0].map((win, i) => (
                         <div key={i} className={`w-2 h-2 rounded-sm ${win ? 'bg-red-600' : 'bg-zinc-800'}`}></div>
                       ))}
                    </div>
                 </div>
                 <div className="mt-2 flex justify-between items-center">
                    <span className="text-[8px] text-zinc-600 font-mono italic">NEXT REWARD: 1,500 GP</span>
                    <span className="text-[10px] text-red-500 font-black animate-pulse">3X MULTIPLIER</span>
                 </div>
              </div>
            </div>
          </TechnicalCard>
        </div>

        {/* Center Column: Broadcast Hub */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg h-[400px] relative overflow-hidden flex flex-col">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                {[
                  { id: 'feed', label: 'Onboard Feed' },
                  { id: 'strategy', label: 'Strategy Room' },
                  { id: 'season', label: 'Season Hub' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-black/80 backdrop-blur-sm text-zinc-500 border border-zinc-800 hover:border-zinc-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'feed' ? (
                <motion.div 
                  key="feed"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="relative h-full w-full bg-zinc-900 group"
                >
                   {/* Simulated Broadcast Stream */}
                   <div className="absolute inset-0 bg-black">
                     {sessionStatus === 'LIVE' ? (
                       <iframe 
                          className="w-full h-full pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-1000"
                          src="https://www.youtube.com/embed/8v23T6iJ_7o?autoplay=1&mute=1&controls=0&loop=1&playlist=8v23T6iJ_7o&start=45" 
                          title="F1 Live Onboard"
                          frameBorder="0"
                          allow="autoplay; encrypted-media"
                       ></iframe>
                     ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-12 text-center">
                          <Activity className="w-12 h-12 text-zinc-800 mb-4 animate-pulse" />
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-2">Signal Lost_</span>
                          <p className="text-xs text-zinc-600 max-w-xs font-mono">BROADCAST_HUB: STANDBY_MODE. WAITING FOR NEXT ACTIVE SESSION DATA PACKETS...</p>
                       </div>
                     )}
                   </div>
                   
                   {/* HUD Overlay */}
                   <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent group-hover:border-red-600/5 transition-all duration-700">
                      <div className="absolute top-16 left-4 flex flex-col gap-1">
                        <div className="bg-black/80 backdrop-blur-sm px-2 py-1 border-l-2 border-red-600">
                          <span className="text-[10px] font-mono text-zinc-400">CAM_ID: NOR_COCKPIT_04</span>
                        </div>
                        <div className="bg-black/40 backdrop-blur-sm px-2 py-1">
                          <span className="text-[9px] font-mono text-zinc-500">SIGNAL_STRENGTH: 98%</span>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-12 bg-black/60 backdrop-blur-md px-12 py-4 rounded-t-2xl border-t border-zinc-800">
                        <div className="text-center">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">SPEED</div>
                          <div className="text-4xl font-black italic tracking-tighter tabular-nums">
                            {telemetry?.cars[0].speed.toFixed(0)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">GEAR</div>
                          <div className="text-4xl font-black text-red-600 italic">8</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">RPM</div>
                          <div className="text-xl font-bold font-mono">
                            {(telemetry?.cars[0].rpm || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                   </div>

                   <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                     Live Stream
                   </div>

                   {/* Interactive Timeline */}
                   <div className="absolute bottom-24 left-4 right-4 h-1 flex items-center justify-between pointer-events-none">
                      {[
                        { lap: 1, type: 'start', label: 'RACE_START' },
                        { lap: 12, type: 'drs', label: 'DRS_ENABLED' },
                        { lap: 22, type: 'pit', label: 'PIT_WINDOW_OPEN' },
                        { lap: 45, type: 'battle', label: 'DIRECT_BATTLE_NOR/VER' }
                      ].map(event => (
                        <div key={event.lap} className="flex flex-col items-center group/evt pointer-events-auto cursor-help relative">
                           <div className="w-2 h-2 bg-zinc-700/50 rounded-full border border-zinc-900 group-hover/evt:bg-red-600 group-hover/evt:scale-150 transition-all shadow-[0_0_8px_rgba(0,0,0,0.5)]"></div>
                           <div className="absolute bottom-4 opacity-0 group-hover/evt:opacity-100 transition-opacity whitespace-nowrap bg-black/90 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-zinc-400 border border-zinc-800 z-[100]">
                              L{event.lap}: {event.label}
                           </div>
                        </div>
                      ))}
                      <div className="absolute inset-0 bg-zinc-800/10 -z-10 rounded-full"></div>
                   </div>
                </motion.div>
              ) : activeTab === 'strategy' ? (
                <motion.div 
                  key="strategy"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="p-8 h-full flex flex-col bg-zinc-950"
                >
                  <div className="flex-1 flex items-end gap-2 pb-8">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                      <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${20 + Math.sin(i + (telemetry?.raceTime || 0)) * 10 + 40}%` }}
                          className={`w-full ${i === 4 ? 'bg-red-600 border-red-400' : 'bg-red-900/20 border-red-900/40'} border-t transition-all`} 
                        />
                        <span className="text-[8px] font-mono text-zinc-600 italic">L{i*5}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 pt-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">PIT WINDOW</div>
                        <div className="text-lg font-bold italic tracking-tighter">18 — 24</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">UNDERCUT_PROB</div>
                        <div className="text-lg font-bold text-red-600">64%</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">LAPS_REMAIN</div>
                        <div className="text-lg font-bold">52</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'season' ? (
                <motion.div 
                  key="season"
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="p-8 h-full bg-zinc-950/20 overflow-y-auto"
                >
                  <div className="max-w-xl mx-auto space-y-8 pb-8">
                    <div className="text-center">
                      <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter">2026 World Championship</h2>
                      <p className="text-[10px] font-mono text-zinc-500 mt-2 uppercase tracking-[0.3em]">Fan Division_ Delta Hub</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                         <span className="text-[8px] font-mono text-zinc-500 uppercase">Season Points</span>
                         <p className="text-xl font-bold font-mono text-[#FF8700]">{(gripPoints * 12).toLocaleString()} <span className="text-[10px] opacity-40">GP</span></p>
                      </div>
                      <div className="bg-zinc-900/50 p-4 rounded border border-zinc-800">
                         <span className="text-[8px] font-mono text-zinc-500 uppercase">Global Rank</span>
                         <p className="text-xl font-bold font-mono text-white">#5,422 <span className="text-[8px] text-green-500 font-mono">▲ 40</span></p>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <span className="text-[10px] font-mono text-zinc-500 uppercase">Tournament Leaderboard</span>
                       <div className="space-y-1">
                         {seasonBoard.map((fan, i) => (
                           <div key={i} className="flex justify-between items-center bg-zinc-900/30 p-3 rounded border border-zinc-900">
                             <div className="flex items-center gap-4">
                               <span className="text-xs font-mono text-zinc-600">0{i+1}</span>
                               <div>
                                 <p className="text-xs font-bold">{fan.name}</p>
                                 <p className="text-[8px] text-zinc-500 font-mono uppercase">{fan.team} FAN</p>
                               </div>
                             </div>
                             <span className="text-xs font-mono font-bold text-zinc-400">{fan.score.toLocaleString()}</span>
                           </div>
                         ))}
                         <div className="flex justify-between items-center bg-red-600/10 p-3 rounded border border-red-600/30 mt-4">
                           <div className="flex items-center gap-4">
                             <span className="text-xs font-mono text-red-600">...</span>
                             <div>
                               <p className="text-xs font-black text-white italic">YOU (Lando_Pulse)</p>
                               <p className="text-[8px] text-red-400 font-mono uppercase">McLaren FAN</p>
                             </div>
                           </div>
                           <span className="text-xs font-mono font-black text-white">{(gripPoints * 12).toLocaleString()}</span>
                         </div>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="positions"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="h-full w-full bg-black flex items-center justify-center p-8"
                >
                  <div className="relative w-full h-full">
                    <img 
                      src="https://www.formula1.com/content/dam/fom-website/manual/Misc/2021-Master/Monaco-GP-Circuit.png" 
                      className="w-full h-full object-contain opacity-20 filter invert grayscale brightness-200" 
                      alt="Track Map"
                    />
                    {/* Simulated Car Dots */}
                    <motion.div 
                      animate={{ x: [0, 100, 200, 150, 0], y: [0, 50, 100, 20, 0] }}
                      transition={{ duration: 10, repeat: Infinity }}
                      className="absolute top-1/2 left-1/2 w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_#ef4444] z-20"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></div>
               <div className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
                 Live_Sim_Alpha_0.2.1
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <TechnicalCard title="Tire Degradation" icon={TrendingDown}>
              <div className="space-y-4">
                {[
                  { drv: 'NOR', tire: 'S', color: 'bg-red-500', health: 88, age: 5, brd: 'border-red-500' },
                  { drv: 'VER', tire: 'M', color: 'bg-yellow-500', health: 62, age: 8, brd: 'border-yellow-500' }
                ].map((t, idx) => (
                  <div key={t.drv} className={`flex items-center justify-between ${idx === 1 ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full border-2 ${t.brd} flex items-center justify-center font-bold text-xs`}>{t.tire}</div>
                      <span className="text-xs font-mono font-bold">{t.drv} (L{t.age})</span>
                    </div>
                    <div className="h-1.5 w-24 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${t.health}%` }}
                        className={`h-full ${t.color}`} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TechnicalCard>

            <TechnicalCard title="ERS Deployment" icon={Zap}>
              <div className="h-32 flex items-center justify-center">
                 <div className="relative w-24 h-24">
                   <svg className="w-full h-full transform -rotate-90">
                     <circle cx="48" cy="48" r="40" stroke="#18181b" strokeWidth="6" fill="none" />
                     <circle 
                        cx="48" cy="48" r="40" 
                        stroke="#ef4444" strokeWidth="6" fill="none" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 * (1 - (0.6 + Math.random() * 0.15))} 
                        className="transition-all duration-1000" 
                      />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-xl font-black italic tracking-tighter">72%</span>
                     <span className="text-[8px] font-mono text-zinc-500 uppercase">Energy</span>
                   </div>
                 </div>
              </div>
            </TechnicalCard>
          </div>
        </div>

        {/* Right Column: Dynamic Feed */}
        <div className="lg:col-span-3 space-y-6">
          <FanEngagementCenter 
            poll={poll} 
            quiz={quiz} 
            quizResult={quizResult}
            onVote={onPollVote}
            onAnswer={onQuizAnswer}
            onReact={sendReaction}
          />

          <TechnicalCard title="Real-Time Leaderboard" icon={MapIcon}>
            <div className="space-y-4">
               <div>
                  <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-widest">Global Driver Standings</div>
                  <div className="space-y-1">
                    {[
                      { pos: 1, name: 'NOR', delta: 'INTERVAL', gap: '', color: '#FF8700' },
                      { pos: 2, name: 'VER', delta: telemetry?.cars[0] && telemetry?.cars[1] ? `+${(telemetry.cars[1].speed < telemetry.cars[0].speed ? 2.4 : 1.8).toFixed(3)}` : '+2.410', gap: '▲ 0.1', color: '#1e41ff' },
                      { pos: 3, name: 'PIA', delta: '+8.142', gap: '▼ 0.3', color: '#FF8700' },
                    ].map((driver, i) => (
                      <div key={driver.name} className={`flex items-center justify-between p-2 rounded transition-colors ${i === 0 ? 'bg-red-600/10 border border-red-600/20' : 'hover:bg-zinc-900 border border-transparent'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono text-zinc-600 w-3">{driver.pos}</span>
                          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                          <span className="text-xs font-black font-mono tracking-tight">{driver.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono font-bold tracking-tighter tabular-nums">{driver.delta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div>
                  <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-widest">Fan Championship</div>
                  <div className="space-y-1">
                    {[
                      { pos: 1, name: 'PulseMaster', gp: 125430, isSelf: false },
                      { pos: 2, name: 'F1_Addict', gp: 98220, isSelf: false },
                      { pos: 3, name: 'You', gp: gripPoints, isSelf: true },
                      { pos: 4, name: 'NorrisFan99', gp: 45100, isSelf: false },
                    ].sort((a,b) => b.gp - a.gp).map((fan, i) => (
                      <div key={fan.name} className={`flex items-center justify-between p-2 rounded transition-colors ${fan.isSelf ? 'bg-[#FF8700]/10 border border-[#FF8700]/30 shadow-[0_0_10px_rgba(255,135,0,0.1)]' : 'hover:bg-zinc-900'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono text-zinc-600 w-3">{i + 1}</span>
                          <span className={`text-[10px] font-bold font-mono tracking-tight ${fan.isSelf ? 'text-[#FF8700]' : 'text-zinc-400'}`}>{fan.name}</span>
                        </div>
                        <div className="text-right">
                          <div className={`text-[10px] font-mono font-bold tabular-nums ${fan.isSelf ? 'text-[#FF8700]' : 'text-zinc-500'}`}>{fan.gp.toLocaleString()} GP</div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-between items-center text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
              <span>Sector 3 Active</span>
              <span className="flex items-center gap-1"><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> S_TRACKER</span>
            </div>
          </TechnicalCard>

          <TechnicalCard title="AI Strategy Engine" icon={Shield}>
             <div className="p-3 text-[10px] leading-relaxed text-zinc-300 font-mono bg-zinc-900/50 rounded border border-zinc-800/50 min-h-[80px]">
               {sessionStatus === 'LIVE' ? (
                 <>
                   <span className="text-red-500 font-bold animate-pulse mr-1">●</span>
                   "Analyzing real-world telemetry stream. {telemetry?.activeAero === 'Low Drag (DRS)' ? 'DRS ENABLED: NOR has tactical advantage.' : 'DRS DISABLED: VER defensive line solid.'} Monitoring pit-window triggers."
                 </>
               ) : (
                 <>
                   <span className="text-zinc-600 font-bold mr-1">○</span>
                   "Race currently OFFLINE. Running Monte Carlo simulations for upcoming session. Historical data suggests 2-stop strategy is optimal for current track temperatures."
                 </>
               )}
             </div>
             <div className="mt-4 flex items-center justify-between px-2">
               <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${sessionStatus === 'LIVE' ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`}></div>
                 <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">
                   {sessionStatus === 'LIVE' ? 'Engine_Synced' : 'Engine_Simulating'}
                 </span>
               </div>
               <span className="text-[8px] text-zinc-600 font-mono">CONF: 94.2%</span>
             </div>
          </TechnicalCard>

          <ChatPanel messages={chatMessages} onSendMessage={onSendMessage} />

          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center h-48 group cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1547447134-cd3f5c716030?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <motion.div 
               animate={{ y: [0, -4, 0] }}
               transition={{ repeat: Infinity, duration: 2 }}
               className="relative"
            >
              <Activity className="w-8 h-8 text-red-600 mb-2" />
            </motion.div>
            <span className="text-xs font-black italic tracking-widest text-center">WATCH COCKPIT LIVE</span>
            <span className="text-[8px] font-mono text-zinc-500 mt-2 uppercase tracking-[0.2em]">AR_OVERLAY_ACTIVE</span>
            <div className="absolute top-2 right-2 flex gap-1">
              <div className="w-1 h-3 bg-red-600"></div>
              <div className="w-1 h-3 bg-zinc-800"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
