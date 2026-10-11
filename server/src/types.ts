export interface LoginData {
  username: string;
  password?: string;
  website?: string;
  hostname?: string;
  fromDesktop?: boolean;
}

export interface BetData {
  matchId?: string | number;
  betId: string | number;
  betDetailId: string | number;
  betTitle?: string;
  marketType?: number | string;
  isBack: boolean;
  rate: number;
  point?: number;
  stake: number;
  isRunnerTypeMarket?: boolean;
  isJodiRates?: boolean;
  currentSelectedItem?: any;
  selectionName?: string;
  sectionName?: string;
  marketName?: string;
  betType?: 'back' | 'lay';
  side?: 'BACK' | 'LAY';
  oddsNumbers?: string;
  placeFrom?: number;
  deviceinfo?: string;
  timestamp?: number;
  idempotencyKey?: string;
}

export interface WebSocketMessage {
  type:
    | 'login'
    | 'bet'
    | 'ping'
    | 'pong'
    | 'recieverCount'
    | 'sendersUpdated'
    | 'changePassword'
    | 'sessionGeo'
    | 'betResult'
    | 'forceLogout';
  data?: any;
  error?: string;
  sender?: string;
  protection?: boolean;
}

export interface ClientSession {
  id: string;
  username: string;
  website: string;
  isSender: boolean;
  isLoggedIn: boolean;
  lastPing: number;
  currentPingMs: number;
  stakes: {
    backStake: number;
    fancyStake: number;
  };
  allowedSenders: string[];
  geoInfo?: {
    lat?: string;
    lon?: string;
    geo?: string;
  };
  ws: any;
}

export interface BetAttempt {
  receiverUsername: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'UNKNOWN';
  message: string;
  latencyMs: number;
  timestamp: number;
}

export interface ParentBetRequest {
  id: string;
  senderUsername: string;
  website: string;
  betData: BetData;
  createdAt: number;
  totalReceiversTargeted: number;
  attempts: Record<string, BetAttempt>;
}
