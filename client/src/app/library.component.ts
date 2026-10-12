import { Component, inject, signal } from '@angular/core';
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
        this.syncing.set(false);
        this.notice.set(`Odświeżono ${result.updated} ${this.gamesWord(result.updated)}.`);
      },
      error: () => {
        this.syncing.set(false);
        this.syncError.set('Nie udało się zsynchronizować biblioteki.');
      },
    });
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
