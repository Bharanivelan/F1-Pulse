import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // Simulation & Sync State
  let raceTime = 0;
  let broadcastDelay = 30000;
  let fanPulse = { positive: 85, excitement: 40 };
  let chatMessages: any[] = [];
  let userGripPoints: Record<string, number> = {};
  let userLevels: Record<string, number> = {};
  let userTeams: Record<string, string> = {};
  let userAchievements: Record<string, string[]> = {};
  let sessionStatus: 'LIVE' | 'OFFLINE' | 'PRACTICE' = 'OFFLINE';
  
  // Seasonal Stats
  let seasonLeaderboard = [
    { name: 'PulseMaster', score: 1254300, team: 'McLaren' },
    { name: 'F1_Addict', score: 982200, team: 'Red Bull' },
    { name: 'StrategyGod', score: 855000, team: 'Ferrari' },
    { name: 'NorrisFan99', score: 712000, team: 'McLaren' },
  ];

  // Engagement State
  let activePoll: { id: string, question: string, options: string[], votes: Record<string, number> } | null = null;
  let activeQuiz: { id: string, question: string, options: string[], correct: number, reward: number } | null = null;
  let liveReactions: Record<string, number> = { "🏎️": 0, "🔥": 0, "👏": 0, "😱": 0, "🏁": 0 };
  
  const broadcastToAll = (msg: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  };

  // Engagement Automation: Trigger random polls and quizzes
  const triggerEngagementEvent = () => {
    if (sessionStatus !== 'LIVE' && Math.random() > 0.3) return; // Less frequent if offline

    const events = [
      () => {
        // Trigger Poll
        activePoll = {
          id: 'poll_' + Date.now(),
          question: "Who will have the fastest lap in this stint?",
          options: ["Norris", "Verstappen", "Piastri", "Leclerc"],
          votes: {}
        };
        broadcastToAll({ type: 'NEW_POLL', poll: activePoll });
        setTimeout(() => { activePoll = null; broadcastToAll({ type: 'END_POLL' }); }, 30000);
      },
      () => {
        // Trigger Quiz
        activeQuiz = {
          id: 'quiz_' + Date.now(),
          question: "How many gears does a modern F1 car have?",
          options: ["6", "7", "8", "9"],
          correct: 2, // "8"
          reward: 1000
        };
        broadcastToAll({ type: 'NEW_QUIZ', quiz: { ...activeQuiz, correct: undefined } });
        setTimeout(() => { activeQuiz = null; broadcastToAll({ type: 'END_QUIZ' }); }, 20000);
      }
    ];

    const randomEvent = events[Math.floor(Math.random() * events.length)];
    randomEvent();
  };

  // Run engagement event every 2 minutes
  setInterval(triggerEngagementEvent, 120000);

  // AI Race Director State
  let lastAiCommentary = "";
  let lastAiCommentaryTime = 0;
  let isAiThrottled = false;
  let dailyAiCount = 0;
  let dailyAiResetTime = Date.now();

  const fallbackRadioMessages = [
    "Box box. Box box. Checking tire carcass temperatures.",
    "Lando, use Strat 3. Gap to Verstappen is closing.",
    "Yellow Flag Sector 2. Hold Delta.",
    "DRS enabled. Use the energy in Turn 3.",
    "Managing front left scrub. We need 5 more laps on this set.",
    "Push now. We are racing for the podium.",
    "Wind gusting at Turn 10. Stay central.",
    "Traffic ahead. Blue flags should be out shortly.",
    "Engine mode 5 for the next two laps. Full power.",
    "Watch the curbs at the swimming pool. High load detected.",
    "Oil pressure stable. Energy recovery at maximum.",
    "Brake balance shift +1. Managing rear stability.",
    "Copy that. We are looking at the data.",
    "Gap to the car ahead is 1.2s. Push for the undercut."
  ];

  const getFallbackCommentary = () => {
    const idx = Math.floor(Math.random() * fallbackRadioMessages.length);
    return fallbackRadioMessages[idx];
  };

  // OpenF1 Data State
  let realTelemetryStore: Record<string, any> = {
    NOR: null,
    VER: null
  };
  
  // Handlers for client messages
  wss.on('connection', (ws) => {
    const userId = 'PULSE_' + Math.floor(Math.random() * 10000);
    userGripPoints[userId] = 0;

    // Send existing state to new client
    ws.send(JSON.stringify({ 
      type: 'INIT', 
      data: { 
        userId,
        chatHistory: chatMessages.slice(-20),
        aiCommentary: lastAiCommentary,
        sessionStatus,
        gripPoints: userGripPoints[userId] || 0,
        level: userLevels[userId] || 1,
        activePoll,
        activeQuiz: activeQuiz ? { ...activeQuiz, correct: undefined } : null, // Hide correct answer
        seasonLeaderboard
      } 
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        const checkAchievements = () => {
          const currentGP = userGripPoints[userId] || 0;
          const currentAchievements = userAchievements[userId] || [];
          let updated = false;

          if (currentGP >= 1000 && !currentAchievements.includes('BRONZE_STRATEGIST')) {
            currentAchievements.push('BRONZE_STRATEGIST');
            updated = true;
          }
          if (currentGP >= 5000 && !currentAchievements.includes('SILVER_ANALYST')) {
            currentAchievements.push('SILVER_ANALYST');
            updated = true;
          }

          if (updated) {
            userAchievements[userId] = currentAchievements;
            ws.send(JSON.stringify({ type: 'ACHIEVEMENT_UNLOCKED', achievements: currentAchievements }));
          }
        };
        
        if (data.type === 'SELECT_TEAM') {
          userTeams[userId] = data.team;
          ws.send(JSON.stringify({ type: 'TEAM_UPDATED', team: data.team }));
        }

        if (data.type === 'LIVE_REACTION') {
          if (liveReactions[data.emoji] !== undefined) {
            liveReactions[data.emoji]++;
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'REACTION_BURST', emoji: data.emoji }));
              }
            });
          }
        }

        if (data.type === 'POLL_VOTE') {
          if (activePoll && activePoll.id === data.pollId) {
            activePoll.votes[data.optionIndex] = (activePoll.votes[data.optionIndex] || 0) + 1;
            broadcastToAll({ type: 'POLL_UPDATE', votes: activePoll.votes });
          }
        }

        if (data.type === 'QUIZ_ANSWER') {
          if (activeQuiz && activeQuiz.id === data.quizId) {
            const isCorrect = data.answerIndex === activeQuiz.correct;
            if (isCorrect) {
              const reward = activeQuiz.reward || 500;
              userGripPoints[userId] = (userGripPoints[userId] || 0) + reward;
              ws.send(JSON.stringify({ type: 'QUIZ_RESULT', correct: true, reward, totalGrip: userGripPoints[userId] }));
              checkAchievements();
            } else {
              ws.send(JSON.stringify({ type: 'QUIZ_RESULT', correct: false }));
            }
          }
        }

        if (data.type === 'FAN_VOTE') {
          userGripPoints[data.userId || userId] = (userGripPoints[data.userId || userId] || 0) + 5;
          checkAchievements();
          if (data.direction === 'up') fanPulse.excitement = Math.min(100, fanPulse.excitement + 2);
          if (data.direction === 'down') fanPulse.excitement = Math.max(0, fanPulse.excitement - 2);
          
          ws.send(JSON.stringify({ type: 'GP_UPDATE', data: userGripPoints[data.userId || userId] }));
        }
        if (data.type === 'SEND_MESSAGE') {
          userGripPoints[data.userId || userId] = (userGripPoints[data.userId || userId] || 0) + 10;
          const newMessage = {
            id: Date.now(),
            user: data.user || 'Fan',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            team: data.team || 'Neutral'
          };
          chatMessages.push(newMessage);
          if (chatMessages.length > 50) chatMessages.shift();
          
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'NEW_MESSAGE', data: newMessage }));
            }
          });
          ws.send(JSON.stringify({ type: 'GP_UPDATE', data: userGripPoints[data.userId || userId] }));
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });
  });

  // AI Race Director - Auto-Commentary
  const runAiRaceDirector = async () => {
    if (telemetryBuffer.length < 10) return;

    // Reset daily count every 24h
    if (Date.now() - dailyAiResetTime > 86400000) {
      dailyAiCount = 0;
      dailyAiResetTime = Date.now();
    }

    // Hard limit for free tier (approx 20 successful requests/day)
    // We use a high threshold if we detect any quota error to stop all attempts
    if (dailyAiCount >= 20 || isAiThrottled) {
      if (Math.random() > 0.7) { // Only occasionally broadcast fallback to reduce traffic if many clients
        lastAiCommentary = getFallbackCommentary();
        broadcastCommentary();
      }
      return;
    }
    
    // Throttle to avoid 429 quota errors (Free Tier)
    const cooldown = 600000; // 10m minimum between AI broadcasts
    if (Date.now() - lastAiCommentaryTime < cooldown) return;

    try {
      const recent = telemetryBuffer.slice(-10);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        config: {
          systemInstruction: "You are the F1 Race Director. Provide a high-intensity, technical radio alert (max 15 words) based on telemetry. Focus on tire wear, speed spikes, or DRS strategy. Do not mention that you are an AI.",
        },
        contents: `Status: ${JSON.stringify(recent)}`,
      });
      
      lastAiCommentary = response.text;
      isAiThrottled = false;
      dailyAiCount++;
      lastAiCommentaryTime = Date.now();
    } catch (e: any) {
      const errMsg = JSON.stringify(e) || String(e);
      
      // If we hit a rate limit (429), switch to throttled mode and block for the day
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("limit")) {
        isAiThrottled = true;
        dailyAiCount = 100; // Hard lock
        console.warn("AI Quota reached. Switching to local telemetry analysis engine.");
      } else {
        console.error("AI Race Director Error:", errMsg);
      }
      
      lastAiCommentary = getFallbackCommentary();
      lastAiCommentaryTime = Date.now();
    } finally {
      broadcastCommentary();
    }
  };

  const broadcastCommentary = () => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'AI_COMMENTARY', data: lastAiCommentary }));
      }
    });
  };

  setInterval(runAiRaceDirector, 60000); // Check once per minute
  
  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", raceTime, bufferSize: telemetryBuffer.length });
  });

  app.post("/api/predict-strategy", async (req, res) => {
    // Check daily quota
    if (dailyAiCount >= 20 || isAiThrottled) {
      return res.json({ 
        prediction: "STRATEGY_OFFLINE: Local engine managing race simulation. Current data suggests staying on existing track position strategy.", 
        timestamp: Date.now() 
      });
    }

    const { telemetry } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an F1 Strategist, analyze this telemetry and predict the next pit window. Keep it under 25 words: ${JSON.stringify(telemetry)}`,
      });
      dailyAiCount++;
      res.json({ prediction: response.text, timestamp: Date.now() });
    } catch (error: any) {
      const errMsg = JSON.stringify(error) || String(error);
      console.error("AI Strategy Error:", errMsg);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("limit")) {
        isAiThrottled = true;
        dailyAiCount = 100;
      }
      res.json({ 
        prediction: "STRATEGY_RECALCULATING: Connection to central strategy server throttled. Maintaining current race delta.", 
        timestamp: Date.now() 
      });
    }
  });

  app.post("/api/sync", express.json(), (req, res) => {
    const { delay } = req.body;
    if (typeof delay === 'number') {
      broadcastDelay = delay * 1000;
      res.json({ success: true, newDelay: broadcastDelay });
    } else {
      res.status(400).json({ error: "Invalid delay" });
    }
  });

  // Real Data Fetcher (OpenF1)
  const fetchOpenF1Data = async () => {
    try {
      // Check for an active session first
      const sessionRes = await fetch('https://api.openf1.org/v1/sessions?session_key=latest');
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json() as any[];
        if (sessionData.length > 0) {
          const session = sessionData[0];
          sessionStatus = (Date.now() - new Date(session.date_end).getTime()) < 3600000 ? 'LIVE' : 'OFFLINE';
        }
      }

      // Fetching Lando Norris (4) and Max Verstappen (1)
      const fetchParams = '&session_key=latest';
      const [res4, res1] = await Promise.all([
        fetch(`https://api.openf1.org/v1/telemetry?driver_number=4${fetchParams}`),
        fetch(`https://api.openf1.org/v1/telemetry?driver_number=1${fetchParams}`)
      ]);

      if (res4.ok) {
        const d4 = await res4.json();
        if (Array.isArray(d4) && d4.length > 0) {
          realTelemetryStore.NOR = d4[d4.length - 1];
          sessionStatus = 'LIVE'; 
        }
      }
      if (res1.ok) {
        const d1 = await res1.json();
        if (Array.isArray(d1) && d1.length > 0) {
          realTelemetryStore.VER = d1[d1.length - 1];
        }
      }
    } catch (e) {
      console.error("OpenF1 Fetch fail (fallback to sim):", e);
      sessionStatus = 'OFFLINE';
    }
  };

  setInterval(fetchOpenF1Data, 5000);

  // Telemetry Buffer for Sync (Stores last 120s of data)
  const telemetryBuffer: any[] = [];
  const MAX_BUFFER_SIZE = 480; 

  // Telemetry Ingestion
  const ingestTelemetry = async () => {
    const nor = realTelemetryStore.NOR;
    const ver = realTelemetryStore.VER;
    
    const rawData = {
      timestamp: Date.now(),
      raceTime: parseFloat((raceTime += 0.25).toFixed(2)),
      cars: [
        { 
          id: 4, 
          driver: "NOR", 
          speed: nor?.speed || (305 + Math.random() * 20), 
          rpm: nor?.rpm || (10500 + Math.random() * 500), 
          tire: "S", 
          tireAge: 5 + (raceTime / 60)
        },
        { 
          id: 1, 
          driver: "VER", 
          speed: ver?.speed || (307 + Math.random() * 15), 
          rpm: ver?.rpm || (10700 + Math.random() * 400), 
          tire: "M", 
          tireAge: 8 + (raceTime / 60)
        },
      ],
      activeAero: nor?.drs > 0 ? "Low Drag (DRS)" : (Math.random() > 0.8 ? "Low Drag" : "High Downforce"),
      fanPulse: { ...fanPulse },
      sessionStatus
    };

    telemetryBuffer.push(rawData);
    if (telemetryBuffer.length > MAX_BUFFER_SIZE) telemetryBuffer.shift();
  };

  // Broadcast Emission (The Anti-Spoiler Engine)
  const emitSyncedData = () => {
    const targetTimestamp = Date.now() - broadcastDelay;
    
    // Find the closest point in history for the TV broadcast
    const syncedData = telemetryBuffer.find(d => Math.abs(d.timestamp - targetTimestamp) < 300);

    if (syncedData) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "TELEMETRY", data: syncedData }));
        }
      });
    }
  };

  setInterval(ingestTelemetry, 250); // Ingest at 4Hz
  setInterval(emitSyncedData, 250);      // Emit at 4Hz (with delay)

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`F1 Live Pulse Server running on http://localhost:${PORT}`);
  });
}

startServer();
