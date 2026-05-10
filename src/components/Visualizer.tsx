import { motion } from "motion/react";
import React, { useState, useRef, useEffect } from "react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

interface VisualizerProps {
  state: VisualizerState;
}

export default function Visualizer({ state }: VisualizerProps) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAvatar = localStorage.getItem("aji3_custom_avatar");
    if (savedAvatar) {
      setAvatarSrc(savedAvatar);
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAvatarSrc(base64);
      localStorage.setItem("aji3_custom_avatar", base64);
      window.dispatchEvent(new Event("avatar_updated")); // Notify header
    };
    reader.readAsDataURL(file);
  };

  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 2 : state === "processing" ? 1 : state === "speaking" ? 1.5 : 20;
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      scale: state === "speaking" ? [1, 1.02, 0.98, 1] : [1, 1, 1],
      transition: { 
        rotate: { duration: baseSpeed + index * 1.5, repeat: Infinity, ease: "linear" },
        scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
      }
    };
  };

  const getPulseAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.08, 0.95, 1.03, 1],
        opacity: [0.7, 1, 0.7, 1, 0.7],
        transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.05, 1],
        opacity: [0.6, 1, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.95, 1.05, 0.95],
        opacity: [0.5, 1, 0.5],
        transition: { duration: 0.5, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.02, 1],
      opacity: [0.3, 0.5, 0.3],
      transition: { duration: 5, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // JARVIS color palette (Cyan/Blue) with Sofia's personality (Violet/Pink hints)
  const getTheme = () => {
    switch (state) {
      case "listening": return { color: "rgba(139, 92, 246, 1)", glow: "shadow-violet-500/60", border: "border-violet-400" };
      case "processing": return { color: "rgba(56, 189, 248, 1)", glow: "shadow-sky-400/80", border: "border-sky-400" };
      case "speaking": return { color: "rgba(236, 72, 153, 1)", glow: "shadow-pink-500/80", border: "border-pink-400" };
      default: return { color: "rgba(6, 182, 212, 0.8)", glow: "shadow-cyan-500/40", border: "border-cyan-500/50" }; // Cyan for idle
    }
  };

  const theme = getTheme();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Background Energy Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
            y: [Math.random() * 200 - 100, Math.random() * 200 - 100],
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute w-64 h-64 rounded-full blur-[100px]"
          style={{ backgroundColor: theme.color }}
        />
      ))}

      {/* Ambient Glow */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[70%] h-[70%] rounded-full blur-[100px] ${theme.glow}`}
        style={{ backgroundColor: theme.color, opacity: 0.1 }}
      />

      {/* Ring 1: Massive Outer Dashed */}
      <motion.div
        animate={getRingAnimation(5, false)}
        className={`absolute w-[110%] h-[110%] rounded-full border-[1px] border-dashed ${theme.border} opacity-10`}
      />

      {/* Ring 2: Segmented Thick Ring */}
      <motion.div
        animate={getRingAnimation(4, true)}
        className={`absolute w-[95%] h-[95%] rounded-full border-[2px] border-dotted ${theme.border} opacity-20`}
      />

      {/* Ring 3: Scanner Ring (Solid with gaps) */}
      <motion.div
        animate={getRingAnimation(3, false)}
        className={`absolute w-[80%] h-[80%] rounded-full border-[1px] ${theme.border} border-t-transparent border-b-transparent opacity-30`}
      />

      {/* Ring 4: Inner Dashed */}
      <motion.div
        animate={getRingAnimation(2, true)}
        className={`absolute w-[65%] h-[65%] rounded-full border-[2px] border-dashed ${theme.border} opacity-40`}
      />
      
      {/* Ring 5: Concentric Thin Rings */}
      <motion.div
        animate={getRingAnimation(1, false)}
        className={`absolute w-[50%] h-[50%] rounded-full border-[1px] ${theme.border} opacity-50`}
      />

      {/* Ring 6: Core HUD Ring */}
      <motion.div
        animate={getRingAnimation(0, true)}
        className={`absolute w-[40%] h-[40%] rounded-full border-[6px] border-dotted ${theme.border} opacity-60`}
      />

      {/* HUD Floating Tech Decals */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`decal-${i}`}
          animate={{
            rotate: [i * 90, i * 90 + 360],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute w-[45%] h-[45%] pointer-events-none"
        >
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] ${theme.border.replace('border-', 'bg-')} bg-opacity-70`} />
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] ${theme.border.replace('border-', 'bg-')} bg-opacity-70`} />
        </motion.div>
      ))}

      {/* Scanner Lines */}
      {state === "listening" && (
        <motion.div 
          animate={{ y: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="absolute w-full h-[2px] bg-white opacity-20 z-10 blur-[1px]"
        />
      )}

      {/* Core Circle */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[32%] h-[32%] rounded-full border-[3px] ${theme.border} bg-black/50 backdrop-blur-xl flex flex-col items-center justify-center shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] overflow-hidden`}
        style={{ boxShadow: `0 0 80px ${theme.color}, inset 0 0 50px ${theme.color}` }}
      >
        {/* Glass Sweep Animation */}
        <motion.div
          animate={{
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 1
          }}
          className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] pointer-events-none z-20"
        />

        {/* Anime Girl Image */}
        <motion.div
          animate={{
            y: state === "idle" ? [0, -15, 0] : state === "speaking" ? [0, -5, 5, -5, 0] : [0, -8, 0],
            scale: state === "speaking" ? [1, 1.05, 1] : [1, 1.02, 1],
          }}
          transition={{
            duration: state === "idle" ? 5 : state === "speaking" ? 0.4 : 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-full h-full flex items-center justify-center bg-zinc-900"
        >
          <img 
            src={avatarSrc || "/aji3_face.png"}
            alt="Aji3 Avatar"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-95 brightness-110 contrast-125 z-10 cursor-pointer hover:opacity-100 transition-opacity"
            onClick={() => fileInputRef.current?.click()}
            onError={(e) => {
               if (avatarSrc) return; // Prevent loop if data URL fails somehow
               // Fallback to a cool aesthetic network image if the user hasn't uploaded the face yet.
               e.currentTarget.src = "https://images.unsplash.com/photo-1541562232579-51fca3bb9b0a?auto=format&fit=crop&w=1080&q=80";
               e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden');
            }}
          />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
          />
          <div className="fallback-text hidden absolute z-30 pointer-events-none inset-0 flex flex-col items-center justify-center text-center text-white/90 text-sm px-8 bg-black/40 backdrop-blur-sm" style={{textShadow: "0 2px 5px black"}}>
            <span className="text-xl mb-2">📸</span>
            Click here to upload<br/>your Anime Face!
          </div>
          {/* Overlay to blend with theme */}
          <div 
            className="absolute inset-0 Mix-blend-overlay opacity-40 z-20 pointer-events-none" 
            style={{ backgroundColor: theme.color }}
          />
        </motion.div>

        {/* Branding Overlay (Bottom) */}
        <div className="absolute bottom-4 left-0 w-full flex justify-center z-30">
          <motion.div 
            animate={{
              color: ["#fff", theme.color.replace('rgba', 'rgb').replace(', 1)', ')'), "#fff"],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="font-bold tracking-[0.4em] text-lg md:text-2xl text-white px-4 py-1 bg-black/70 rounded-full border border-white/20 backdrop-blur-md shadow-lg"
            style={{ textShadow: `0 0 15px ${theme.color}` }}
          >
            AJI3
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
