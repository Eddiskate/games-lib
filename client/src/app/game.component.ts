import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameService } from './game.service';
import { Game } from './models';

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

  constructor() {
    this.gamesApi.get(this.route.snapshot.paramMap.get('id') || '').subscribe({
      next: (game) => this.game.set(game),
      error: () => this.error.set('Nie udało się otworzyć tej gry.'),
    });
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
