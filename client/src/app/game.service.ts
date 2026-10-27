import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Game, GameDraft, LookupResult, PlayStatus } from './models';

@Injectable({ providedIn: 'root' })
export class GameService {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Game[]>('/api/games');
  }

  sync() {
    return this.http.post<{ games: Game[]; updated: number }>('/api/games/sync', {});
  }

  get(id: string) {
    return this.http.get<Game>(`/api/games/${id}`);
  }

  lookup(barcode: string) {
    return this.http.post<LookupResult>('/api/games/lookup', { barcode });
  }

  search(query: string) {
    return this.http.get<LookupResult>('/api/games/search', { params: { q: query } });
  }

  add(draft: GameDraft, barcode = '') {
    return this.http.post<{ game: Game; already: boolean }>('/api/games', { ...draft, barcode });
  }

  remove(id: string) {
    return this.http.delete(`/api/games/${id}`);
  }

  setStatus(id: string, playStatus: PlayStatus) {
    return this.http.patch<Game>(`/api/games/${id}`, { playStatus });
  }

  setPlatform(id: string, platforms: string[]) {
    return this.http.patch<Game>(`/api/games/${id}`, { platforms });
  }
}
