import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameService } from './game.service';
import { Game, PlayStatus } from './models';

@Component({
  selector: 'app-game',
  imports: [RouterLink],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css',
})
export class GameComponent {
  private gamesApi = inject(GameService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly game = signal<Game | null>(null);
  readonly error = signal('');
  readonly selectedPhoto = signal('');
  readonly statuses: { id: PlayStatus; label: string }[] = [
    { id: 'nowa', label: 'Nowa' },
    { id: 'w toku', label: 'W toku' },
    { id: 'ukończona', label: 'Ukończona' },
  ];

  constructor() {
    this.gamesApi.get(this.route.snapshot.paramMap.get('id') || '').subscribe({
      next: (game) => {
        this.selectedPhoto.set('');
        this.game.set(game);
      },
      error: () => this.error.set('Nie udało się otworzyć tej gry.'),
    });
  }

  currentStatus(game: Game) {
    return game.playStatus || 'nowa';
  }

  photos(game: Game) {
    return [game.coverUrl, ...(game.boxImages || [])].filter((url, index, all) => url && all.indexOf(url) === index);
  }

  activePhoto(game: Game) {
    const chosen = this.selectedPhoto();
    return chosen && this.photos(game).includes(chosen) ? chosen : game.coverUrl;
  }

  setStatus(playStatus: PlayStatus) {
    const game = this.game();
    if (!game || this.currentStatus(game) === playStatus) return;
    this.gamesApi.setStatus(game._id, playStatus).subscribe({
      next: (updated) => this.game.set({ ...game, ...updated }),
      error: () => this.error.set('Nie udało się zapisać statusu.'),
    });
  }

  dollars(cents?: number | null) {
    if (cents == null) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  hasPrice(game: Game) {
    return game.priceCib != null || game.priceLoose != null || game.priceNew != null;
  }

  remove() {
    const game = this.game();
    if (!game || !confirm(`Usunąć „${game.title}” z biblioteki?`)) return;
    this.gamesApi.remove(game._id).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => this.error.set('Nie udało się usunąć gry.'),
    });
  }
}
