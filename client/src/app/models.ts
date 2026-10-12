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
  released?: string;
  platforms?: string[];
  genres?: string[];
  rating?: number | null;
  source?: string;
  externalId?: string;
}

export interface Game extends GameDraft {
  _id: string;
  barcode: string;
  title: string;
  description: string;
  coverUrl: string;
  released: string;
  platforms: string[];
  genres: string[];
  createdAt: string;
}

export interface LookupResult {
  barcode: string;
  candidates: GameDraft[];
  game?: Game;
  already?: boolean;
}
