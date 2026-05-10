
interface MemoryFact {
  id: string;
  fact: string;
  timestamp: number;
}

const MEMORY_KEY = "sofia_long_term_memory";

export function getMemory(): string {
  const saved = localStorage.getItem(MEMORY_KEY);
  if (!saved) return "No specific memories yet.";
  try {
    const memories: MemoryFact[] = JSON.parse(saved);
    return memories.map(m => `- ${m.fact}`).join("\n");
  } catch (e) {
    return "No specific memories yet.";
  }
}

export function saveMemory(fact: string) {
  const saved = localStorage.getItem(MEMORY_KEY);
  let memories: MemoryFact[] = [];
  if (saved) {
    try {
      memories = JSON.parse(saved);
    } catch (e) {}
  }
  
  // Basic check to avoid duplicates or very similar facts
  if (memories.some(m => m.fact.toLowerCase() === fact.toLowerCase())) return;

  memories.push({
    id: Date.now().toString(),
    fact,
    timestamp: Date.now()
  });

  // Keep only the last 50 important memories
  if (memories.length > 50) memories.shift();
  
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
}

export function clearMemory() {
  localStorage.removeItem(MEMORY_KEY);
}
