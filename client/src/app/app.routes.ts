import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { GameComponent } from './game.component';
import { LibraryComponent } from './library.component';
import { LoginComponent } from './login.component';
import { ScanComponent } from './scan.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: LibraryComponent, canActivate: [authGuard] },
  { path: 'scan', component: ScanComponent, canActivate: [authGuard] },
  { path: 'game/:id', component: GameComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
