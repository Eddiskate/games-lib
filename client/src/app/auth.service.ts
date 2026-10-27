import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly user = signal<User | null>(null);
  readonly token = signal<string | null>(localStorage.getItem('token'));

  constructor() {
    queueMicrotask(() => this.restore());
  }

  isLoggedIn() {
    return !!this.token();
  }

  register(name: string, email: string, password: string) {
    return this.keep(this.http.post<AuthResponse>('/api/auth/register', { name, email, password }));
  }

  login(email: string, password: string) {
    return this.keep(this.http.post<AuthResponse>('/api/auth/login', { email, password }));
  }

  me() {
    return this.http.get<User>('/api/auth/me').pipe(tap((user) => this.user.set(user)));
  }

  logout() {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  clear() {
    localStorage.removeItem('token');
    this.token.set(null);
    this.user.set(null);
  }

  private restore() {
    if (!this.token()) return;
    this.me().subscribe({
      next: () => undefined,
      error: (error) => {
        if (error?.status === 401) this.logout();
      },
    });
  }

  private keep(request: Observable<AuthResponse>) {
    return request.pipe(tap((response) => {
      localStorage.setItem('token', response.token);
      this.token.set(response.token);
      this.user.set(response.user);
    }));
  }
}
