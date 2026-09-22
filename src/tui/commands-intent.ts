// Natural language prompt intent matching and keyword slash command discovery for OpenClaw TUI.

export type IntentMatch = {
  command: string;
  description: string;
  matchedPhrase: string;
};

export type KeywordMatch = {
  command: string;
  description: string;
  matchedKeyword: string;
  score: number;
};

type IntentRule = {
  pattern: RegExp;
  command: string;
  description: string;
};

export const INTENT_RULES: readonly IntentRule[] = [
  // Session reset & fresh start -> /new (or /reset)
  {
    pattern:
      /\b(new\s+(session|chat|conversation)|fresh\s+(session|chat|start)|reset\s+(session|chat|conversation|all|history)|clear\s+(session|chat|conversation|memory|history)|restart\s+(session|chat)|wipe\s+(chat|history|session)|nayi\s+chat|naya\s+session|chat\s+reset|reset\s+kardo|shuru\s+se|nueva\s+sesion|reiniciar\s+chat|recommencer)\b/i,
    command: "new",
    description: "Spawn a new isolated session",
  },
  // Terminal clear screen -> /clear
  {
    pattern: /\b(clear\s+screen|cls|clear\s+terminal|clean\s+screen|screen\s+clear)\b/i,
    command: "clear",
    description: "Clear the terminal screen",
  },
  // Model switching -> /model
  {
    pattern:
      /\b(switch\s+model|change\s+model|choose\s+model|select\s+model|pick\s+model|model\s+selector|model\s+list|change\s+llm|switch\s+llm|model\s+badlo|dusra\s+model|model\s+change|cambiar\s+modelo|changer\s+de\s+modele)\b/i,
    command: "model",
    description: "Set model (or open picker)",
  },
  // Token usage & cost -> /usage
  {
    pattern:
      /\b(session\s+cost|token\s+cost|how\s+much\s+(cost|spent|spend)|check\s+cost|show\s+cost|total\s+spend|api\s+cost|pricing|token\s+usage|show\s+usage|tokens\s+used|how\s+many\s+tokens|tokens\s+kitne|kitna\s+kharcha|cost\s+kitni|kitne\s+paise|kharcha\s+kitna|cuanto\s+cuesta|combien\s+coute)\b/i,
    command: "usage",
    description: "Toggle per-response usage line or show cost summary",
  },
  // Thinking / reasoning depth -> /think
  {
    pattern:
      /\b(thinking\s+level|change\s+thinking|set\s+thinking|deep\s+thinking|think\s+more|think\s+less|reasoning\s+level|set\s+reasoning|soch\s+badlo|jyada\s+socho)\b/i,
    command: "think",
    description: "Set thinking level",
  },
  // Fast mode toggle -> /fast
  {
    pattern:
      /\b(fast\s+mode|speed\s+up|faster\s+response|quick\s+mode|jaldi\s+karo|fast\s+karo)\b/i,
    command: "fast",
    description: "Set fast mode auto/on/off",
  },
  // Verbose logging -> /verbose
  {
    pattern: /\b(verbose\s+mode|verbose\s+logging|debug\s+logs|detailed\s+logs|more\s+details)\b/i,
    command: "verbose",
    description: "Set verbose on/off/full",
  },
  // Agent switching -> /agent
  {
    pattern:
      /\b(switch\s+agent|change\s+agent|select\s+agent|pick\s+agent|list\s+agents|agent\s+badlo|dusra\s+agent)\b/i,
    command: "agent",
    description: "Switch agent (or open picker)",
  },
  // Session switching -> /session
  {
    pattern: /\b(switch\s+session|change\s+session|select\s+session|list\s+sessions)\b/i,
    command: "session",
    description: "Switch session (or open picker)",
  },
  // Status & health -> /status
  {
    pattern:
      /\b(agent\s+status|system\s+status|gateway\s+status|health\s+check|status\s+check|status\s+dikhao|status\s+kya\s+hai)\b/i,
    command: "status",
    description: "Show gateway status summary",
  },
  // Stop / abort run -> /stop
  {
    pattern: /\b(stop\s+generation|cancel\s+task|abort\s+run|stop\s+agent|rok\s+do|band\s+karo)\b/i,
    command: "stop",
    description: "Abort active run",
  },
  // Help & command list -> /help
  {
    pattern:
      /\b(help\s+me|show\s+commands|list\s+commands|what\s+commands|available\s+commands|commands\s+list|help\s+menu|commands\s+dikhao|kya\s+commands)\b/i,
    command: "help",
    description: "Show slash command help",
  },
  // Settings -> /settings
  {
    pattern: /\b(open\s+settings|configure\s+agent|user\s+preferences|settings\s+kholo)\b/i,
    command: "settings",
    description: "Open settings",
  },
  // Elevated permissions -> /elevated
  {
    pattern: /\b(elevated\s+mode|admin\s+mode|sudo\s+mode|grant\s+permission|elevation)\b/i,
    command: "elevated",
    description: "Set elevated on/off/ask/full",
  },
];

export const KEYWORD_TAGS: Record<string, readonly string[]> = {
  usage: [
    "token",
    "tokens",
    "cost",
    "pricing",
    "spend",
    "spending",
    "price",
    "bill",
    "billing",
    "quota",
    "consumption",
    "kharcha",
  ],
  model: ["switch", "llm", "provider", "select", "choose", "badlo", "pick"],
  new: ["fresh", "start", "restart", "wipe", "nayi", "naya", "clean"],
  reset: ["clean", "wipe", "restart", "fresh"],
  clear: ["cls", "screen", "terminal", "clean"],
  think: ["thinking", "reasoning", "thought", "deep", "depth"],
  reasoning: ["thinking", "depth", "stream", "deliberation"],
  fast: ["speed", "quick", "rapid", "turbo", "jaldi"],
  verbose: ["debug", "detailed", "trace", "logging"],
  status: ["gateway", "health", "system", "ping", "alive"],
  stop: ["abort", "cancel", "halt", "kill", "rok"],
  agent: ["persona", "bot", "assistant", "subagent"],
  session: ["thread", "history", "conversation", "branch"],
  help: ["commands", "manual", "info", "guide", "docs"],
  settings: ["config", "preferences", "options", "setup"],
  elevated: ["sudo", "admin", "permissions", "root", "bypass"],
  exit: ["quit", "bye", "close"],
};

export function matchPromptIntent(text: string): IntentMatch[] {
  const cleaned = text.trim();
  if (cleaned.length < 3 || cleaned.length > 100) {
    return [];
  }

  const matches: IntentMatch[] = [];
  const seen = new Set<string>();

  for (const rule of INTENT_RULES) {
    const match = rule.pattern.exec(cleaned);
    if (match && !seen.has(rule.command)) {
      seen.add(rule.command);
      matches.push({
        command: rule.command,
        description: rule.description,
        matchedPhrase: match[0],
      });
    }
  }

  return matches;
}

export function matchSlashKeywords(
  word: string,
  availableCommands?: ReadonlySet<string>,
): KeywordMatch[] {
  if (!word || word.length < 2) {
    return [];
  }

  const lowered = word.toLowerCase();
  const scoredResults: KeywordMatch[] = [];
  const seen = new Set<string>();

  for (const [cmd, tags] of Object.entries(KEYWORD_TAGS)) {
    if (availableCommands && availableCommands.size > 0 && !availableCommands.has(cmd)) {
      continue;
    }
    for (const tag of tags) {
      let score = 0;
      if (tag === lowered) {
        score = 100;
      } else if (tag.startsWith(lowered)) {
        score = 80;
      } else if (lowered.length >= 4 && tag.includes(lowered)) {
        score = 50;
      }

      if (score > 0) {
        if (!seen.has(cmd)) {
          seen.add(cmd);
          scoredResults.push({
            command: cmd,
            description: `Matched keyword '${tag}'`,
            matchedKeyword: tag,
            score,
          });
        }
        break;
      }
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults;
}
