declare const engine: {
  currentProgram: (guide: unknown, id: string, now?: number) => unknown
  fuzzyScore: (value: string, query: string) => number
  mirrorUrls: (
    channel: { name: string; url: string; mirror?: string },
    mirrors: Record<string, string[]>
  ) => string[]
  parseQuery: (value: string) => { text: string; group: string; source: string }
  searchChannels: <T extends { name: string; url: string }>(
    channels: T[],
    query: string,
    limit?: number
  ) => T[]
}

export default engine
