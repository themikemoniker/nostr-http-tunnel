export interface TunnelConfig {
  npub: string;
  relays: string[];
}

let cached: TunnelConfig | null = null;

export async function loadConfig(): Promise<TunnelConfig> {
  if (cached) return cached;
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'config.json');
    if (res.ok) {
      cached = await res.json();
      return cached!;
    }
  } catch {
    // config.json not found or invalid, use defaults
  }
  cached = { npub: '', relays: ['wss://relay.damus.io', 'wss://nos.lol'] };
  return cached;
}
