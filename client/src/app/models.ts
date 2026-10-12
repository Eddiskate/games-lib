export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface GameDraft {
  barcode?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  boxImages?: string[];
  released?: string;
  platforms?: string[];
  genres?: string[];
  rating?: number | null;
  source?: string;
  externalId?: string;
  playStatus?: PlayStatus;
  priceLoose?: number | null;
  priceCib?: number | null;
  priceNew?: number | null;
  priceName?: string;
  priceConsole?: string;
  priceId?: string;
  pricesEnabled?: boolean;
}

export type PlayStatus = 'nowa' | 'w toku' | 'ukończona';

export interface Game extends GameDraft {
  _id: string;
  barcode: string;
  title: string;
  description: string;
  coverUrl: string;
  boxImages: string[];
  released: string;
  platforms: string[];
  genres: string[];
  playStatus: PlayStatus;
  priceLoose: number | null;
  priceCib: number | null;
  priceNew: number | null;
  priceName: string;
  priceConsole: string;
  priceId: string;
  pricesEnabled?: boolean;
  createdAt: string;
}

export interface LookupResult {
  barcode: string;
  candidates: GameDraft[];
  game?: Game;
  already?: boolean;
}
