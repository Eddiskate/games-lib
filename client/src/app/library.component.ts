import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from './game.service';
import { Game, PlayStatus } from './models';

@Component({
  selector: 'app-library',
  imports: [RouterLink],
  templateUrl: './library.component.html',
  styleUrl: './library.component.css',
})
export class LibraryComponent {
  private gamesApi = inject(GameService);
  readonly games = signal<Game[] | null>(null);
  readonly error = signal('');
  readonly syncError = signal('');
  readonly notice = signal('');
  readonly syncing = signal(false);
  readonly platform = signal('');
  readonly platforms = computed(() => {
    const names = new Set<string>();
    let unknown = false;
    for (const game of this.games() ?? []) {
      if (!game.platforms?.length) unknown = true;
      for (const name of game.platforms || []) names.add(name);
    }
    return {
      names: [...names].sort((a, b) => a.localeCompare(b, 'pl')),
      unknown,
    };
  });
  readonly visibleGames = computed(() => {
    const games = this.games() ?? [];
    const platform = this.platform();
    if (!platform) return games;
    if (platform === '*unknown') return games.filter((game) => !game.platforms?.length);
    return games.filter((game) => (game.platforms || []).includes(platform));
  });

  constructor() {
    this.gamesApi.list().subscribe({
      next: (games) => this.games.set(games),
      error: () => this.error.set('Nie udało się wczytać biblioteki.'),
    });
  }

  sync() {
    if (this.syncing() || !this.games()?.length) return;
    this.syncing.set(true);
    this.syncError.set('');
    this.notice.set('');
    this.gamesApi.sync().subscribe({
      next: (result) => {
        this.games.set(result.games);
        this.keepPlatform(result.games);
        this.syncing.set(false);
        this.notice.set(`Odświeżono ${result.updated} ${this.gamesWord(result.updated)}.`);
      },
      error: () => {
        this.syncing.set(false);
        this.syncError.set('Nie udało się zsynchronizować biblioteki.');
      },
    });
  }

  keepPlatform(games: Game[]) {
    const selected = this.platform();
    if (!selected) return;
    if (selected === '*unknown') {
      if (games.some((game) => !game.platforms?.length)) return;
    } else if (games.some((game) => (game.platforms || []).includes(selected))) {
      return;
    }
    this.platform.set('');
  }

  gamesWord(count: number) {
    if (count === 1) return 'grę';
    const last = count % 10;
    const lastTwo = count % 100;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'gry';
    return 'gier';
  }

  statusLabel(status?: PlayStatus) {
    if (status === 'w toku') return 'W toku';
    if (status === 'ukończona') return 'Ukończona';
    return 'Nowa';
  }

  dollars(cents?: number | null) {
    if (cents == null) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }
}
