import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);

  readonly registerMode = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.formBuilder.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigateByUrl('/');
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    if (this.registerMode() && !name.trim()) {
      this.error.set('Podaj imię.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const request = this.registerMode()
      ? this.auth.register(name.trim(), email, password)
      : this.auth.login(email, password);
    request.subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (error) => {
        this.busy.set(false);
        this.error.set(error.error?.message || 'Nie udało się zalogować.');
      },
    });
  }
}
