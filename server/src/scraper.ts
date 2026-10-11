import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface MarketPrice {
  betDetailId: number | string;
  runnerName: string;
  backPrice: number;
  backSize?: number;
  layPrice: number;
  laySize?: number;
  status: 'ACTIVE' | 'BALL_RUNNING' | 'SUSPENDED';
}

export interface MarketEvent {
  matchId: string;
  matchName: string;
  marketType: string;
  marketName: string;
  isBallRunning: boolean;
  ballRunningPredictedAt?: number;
  prices: MarketPrice[];
  lastUpdated: number;
}

export class ExchangeScraper {
  private proxyList: string[] = [];
  private proxyIndex = 0;
  private isRunning = false;
  private intervalMs = 500; // Poll every 500ms for high-frequency odds
  private cache = new Map<string, MarketEvent>();

  constructor(proxies: string[] = []) {
    this.proxyList = proxies;
  }

  private getNextProxy(): string | null {
    if (this.proxyList.length === 0) return null;
    const p = this.proxyList[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.proxyList.length;
    return p;
  }

  private getAxiosInstance() {
    const proxyUrl = this.getNextProxy();
    const config: any = {
      timeout: 3000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    };

    if (proxyUrl) {
      config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    return axios.create(config);
  }

  public async fetchMarketOdds(targetUrl: string): Promise<MarketEvent | null> {
    const client = this.getAxiosInstance();
    try {
      const response = await client.get(targetUrl);
      const raw = response.data;

      // Normalize exchange market payload
      const market: MarketEvent = {
        matchId: raw.matchId || raw.mid || '12345',
        matchName: raw.matchName || raw.ename || 'Live Cricket Match',
        marketType: raw.marketType || 'MATCH_ODDS',
        marketName: raw.marketName || 'Match Odds',
        isBallRunning: !!(raw.isBallRunning || raw.ballRunning || raw.status === 'BR'),
        prices: (raw.runners || raw.selections || []).map((r: any) => ({
          betDetailId: r.betDetailId || r.sid,
          runnerName: r.betTitle || r.nation || r.runnerName,
          backPrice: Number(r.backRate1 || r.backPrice || 0),
          layPrice: Number(r.layRate1 || r.layPrice || 0),
          status: r.status === 'BR' ? 'BALL_RUNNING' : 'ACTIVE',
        })),
        lastUpdated: Date.now(),
      };

      // Time Controller: 2-3s pre-lock detector
      if (raw.estimatedBallRunningInMs && raw.estimatedBallRunningInMs <= 3000) {
        console.warn(`[SCRAPER ALERT] Ball running state predicted in ${raw.estimatedBallRunningInMs}ms!`);
        market.ballRunningPredictedAt = Date.now() + raw.estimatedBallRunningInMs;
      }

      this.cache.set(market.matchId, market);
      return market;
    } catch (err: any) {
      console.error(`[SCRAPER ERROR] Proxy fail or rate-limit on ${targetUrl}:`, err.message);
      return null;
    }
  }

  public startPolling(targetUrls: string[]) {
    this.isRunning = true;
    console.log(`[SCRAPER] Started high-frequency scraper on ${targetUrls.length} targets`);

    const poll = async () => {
      if (!this.isRunning) return;
      for (const url of targetUrls) {
        await this.fetchMarketOdds(url);
      }
      setTimeout(poll, this.intervalMs);
    };

    poll();
  }

  public stop() {
    this.isRunning = false;
  }

  public getCachedMarket(matchId: string) {
    return this.cache.get(matchId);
  }
}

// Standalone execution test
if (require.main === module) {
  const scraper = new ExchangeScraper();
  console.log('[SCRAPER] Service ready. Awaiting exchange URLs...');
}
