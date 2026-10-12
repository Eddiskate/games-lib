import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from './game.service';
import { Game } from './models';

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

  constructor() {
    this.gamesApi.list().subscribe({
      next: (games) => this.games.set(games),
      error: () => this.error.set('Nie udało się wczytać biblioteki.'),
    });
  }
}
