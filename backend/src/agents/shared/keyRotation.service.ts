// ??$$$ group 2 - Ideation Stage (Phase 1)
import Groq from "groq-sdk";
import SystemConfig from "../../models/systemConfig.model";

type GroqClient = InstanceType<typeof Groq>;

class KeyRotationService {
  private keys: string[];
  private currentIndex: number;
  private clients: Map<string, GroqClient>;

  constructor() {
    this.keys = this._loadKeys();
    this.currentIndex = 0;
    this.clients = new Map<string, GroqClient>();
  }

  private _loadKeys(): string[] {
    const keys: string[] = [];

    // Primary key
    if (process.env.GROQ_API_KEY) {
      keys.push(process.env.GROQ_API_KEY);
    }

    // Additional keys: GROQ_API_KEY_2 up to 33
    for (let i = 2; i <= 33; i++) {
      const key = process.env[`GROQ_API_KEY_${i}`];
      if (key) keys.push(key);
    }

    console.log(`[KeyRotationService] Loaded ${keys.length} API keys.`);
    return keys;
  }

  private async _getCurrentIndex(): Promise<number> {
    try {
      const config = await SystemConfig.findOne({ key: "groq_key_index" });

      if (config) {
        this.currentIndex = config.value % this.keys.length;
      }

      return this.currentIndex;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[KeyRotationService] Error getting index from MongoDB:",
        message
      );
      return this.currentIndex;
    }
  }

  private async _setNextIndex(): Promise<void> {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;

    try {
      await SystemConfig.findOneAndUpdate(
        { key: "groq_key_index" },
        { value: this.currentIndex },
        { upsert: true }
      );

      console.log(
        `[KeyRotationService] Rotated to key index ${this.currentIndex}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[KeyRotationService] Error saving index to MongoDB:",
        message
      );
    }
  }

  public async getClient(offset = 0): Promise<GroqClient> {
    if (this.keys.length === 0) {
      throw new Error("No Groq API keys found in environment.");
    }

    const currentIndex = await this._getCurrentIndex();
    const index = (currentIndex + offset) % this.keys.length;
    const apiKey = this.keys[index];

    if (!this.clients.has(apiKey)) {
      this.clients.set(apiKey, new Groq({ apiKey }));
    }

    return this.clients.get(apiKey)!;
  }

  public async handleRateLimit(): Promise<void> {
    console.warn(
      "[KeyRotationService] Rate limit detected. Rotating key..."
    );
    await this._setNextIndex();
  }
}

const rotationService = new KeyRotationService();
export default rotationService;
