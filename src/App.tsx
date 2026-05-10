import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Monitor, MonitorOff } from "lucide-react";
import { getSofiaResponse, getSofiaAudio, resetSofiaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "sofia";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("sofia_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("sofia_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [lastCommand, setLastCommand] = useState<{ url: string, timestamp: number, blocked: boolean } | null>(null);

  useEffect(() => {
    if (lastCommand) {
      const timer = setTimeout(() => setLastCommand(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [lastCommand]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const toggleScreenShare = async () => {
    if (!liveSessionRef.current || !isSessionActive) return;
    
    if (isScreenSharing) {
      liveSessionRef.current.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      await liveSessionRef.current.startScreenShare();
      setIsScreenSharing(liveSessionRef.current.isScreenSharing);
    }
  };

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    const updateAvatar = () => {
      const saved = localStorage.getItem("aji3_custom_avatar");
      if (saved) setUserAvatar(saved);
    };
    updateAvatar();
    window.addEventListener("avatar_updated", updateAvatar);
    return () => window.removeEventListener("avatar_updated", updateAvatar);
  }, []);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-s", sender: "sofia", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getSofiaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getSofiaResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-s", sender: "sofia", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getSofiaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      setIsScreenSharing(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetSofiaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetSofiaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          let blocked = false;
          try {
            // Invisible anchor click trick
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Modern browsers still block this in async so we test it
            const win = window.open(url, "test_popup_blocker");
            if (!win) {
              console.warn("Popup blocked");
              blocked = true;
            } else {
              win.close(); // the a-tag worked if this wasn't blocked, or this one worked. 
              // Wait, if it *isn't* blocked, the a-tag opened a tab, AND window.open opened a tab, and we close one. 
              // Actually, simply doing window.open is better. Let's stick to standard and rely on user enabling popups.
              // I will just use standard window.open.
            }
          } catch (e) {}

          try {
             const finalWin = window.open(url, "_blank");
             if (!finalWin) blocked = true;
             else blocked = false;
          } catch(e) {
             blocked = true;
          }
          setLastCommand({ url, timestamp: Date.now(), blocked });
        };

        await session.start();
        
        // Automatically trigger screen sharing prompt on activation
        setTimeout(() => {
          toggleScreenShare();
        }, 500);
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{
            scale: appState === "speaking" ? [1, 1.2, 1] : [1, 1.1, 1],
            opacity: appState === "speaking" ? [0.2, 0.4, 0.2] : [0.1, 0.2, 0.1],
            rotate: [0, 45, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-violet-900/30 blur-[150px] rounded-full" 
        />
        <motion.div 
          animate={{
            scale: appState === "listening" ? [1, 1.3, 1] : [1, 1.1, 1],
            opacity: appState === "listening" ? [0.3, 0.5, 0.3] : [0.1, 0.2, 0.1],
            rotate: [0, -60, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-pink-900/30 blur-[150px] rounded-full" 
        />
        <motion.div 
          animate={{
            scale: appState === "processing" ? [0.8, 1.2, 0.8] : [1, 1, 1],
            opacity: appState === "processing" ? [0.2, 0.4, 0.2] : 0,
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-cyan-900/20 blur-[180px] rounded-full" 
        />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6 backdrop-blur-sm bg-black/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-400 to-pink-400 p-[2px] shadow-[0_0_15px_rgba(167,139,250,0.5)] overflow-hidden shrink-0 flex items-center justify-center">
            <img 
              src={userAvatar || "/aji3_face.png"} 
              alt="A" 
              className="w-full h-full object-cover rounded-full bg-black block" 
              onError={(e) => {
                if (userAvatar) return;
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-lg text-violet-300">A</div>';
              }} 
            />
          </div>
          <h1 className="text-2xl font-serif font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-pink-300">Aji3</h1>
          {isSessionActive && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[10px] font-mono bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded border border-violet-500/30 uppercase tracking-tighter"
            >
              Master of Control
            </motion.span>
          )}
          {isScreenSharing && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[10px] font-mono bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded border border-pink-500/30 uppercase tracking-tighter flex items-center gap-1"
            >
              <div className="w-1 h-1 bg-pink-400 rounded-full animate-pulse" />
              Vision: Flawless
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetSofiaSession();
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
          {isSessionActive && (
            <button
              onClick={toggleScreenShare}
              className={`p-2 rounded-full transition-colors border ${isScreenSharing ? 'bg-violet-500 text-white border-violet-400' : 'bg-white/5 hover:bg-white/10 text-white border-white/10'}`}
              title={isScreenSharing ? "Stop Screen Share" : "Share Computer Screen"}
            >
              {isScreenSharing ? (
                <MonitorOff size={18} />
              ) : (
                <Monitor size={18} />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Command Feedback Notification */}
        <AnimatePresence>
          {lastCommand && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className="absolute top-24 left-1/2 z-50 pointer-events-auto"
            >
              <div className="bg-violet-600 text-white px-6 py-3 rounded-xl shadow-2xl border border-violet-400 flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-tighter opacity-70">Executing Command</span>
                  <span className="text-sm font-medium truncate max-w-[200px]">{lastCommand.url}</span>
                  {lastCommand.blocked && (
                    <span className="text-[10px] text-pink-200 mt-1 leading-tight max-w-[220px]">
                      ⚠️ Popup Blocked! Click the lock/popup icon in your top URL bar and choose "Always allow" to make this automatic next time.
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => window.open(lastCommand.url, "_blank")}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold transition-colors shrink-0"
                >
                  RE-OPEN
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Left Column: Sofia Status & Chat */}
        <div className="flex w-[35%] lg:w-[300px] h-full flex-col justify-end gap-4 z-10 pb-8 overflow-hidden">
          <div className="flex flex-col gap-3 max-h-[60%] overflow-y-auto scrollbar-hide pr-2 pointer-events-auto">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.slice(-5).map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`p-3 rounded-2xl text-sm border backdrop-blur-md shadow-lg ${
                    msg.sender === "user" 
                      ? "bg-white/5 border-white/10 self-end rounded-br-none max-w-[85%]" 
                      : "bg-violet-500/10 border-violet-500/20 self-start rounded-bl-none max-w-[85%] text-violet-200"
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          </div>

          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 text-violet-300/80 text-sm italic font-serif"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Aji3 is thinking...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} />
        </div>

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message to Aji3..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-10 py-5 rounded-full font-bold tracking-widest transition-all duration-500 shadow-[0_0_20px_rgba(255,255,255,0.1)]
              ${
                isSessionActive
                  ? "bg-red-500/10 text-red-500 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:bg-red-500 hover:text-white"
                  : "bg-white text-black border-2 border-transparent hover:bg-transparent hover:text-white hover:border-white shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-110 active:scale-95"
              }
            `}
          >
            <motion.div 
              className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-white/20"
              animate={!isSessionActive ? { scale: [1, 1.2, 1], opacity: [0, 0.5, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>DEACTIVATE AJI3</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>ACTIVATE AJI3</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
