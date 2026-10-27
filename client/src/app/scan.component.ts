import { Component, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { GameService } from './game.service';
import { GameDraft } from './models';

@Component({
  selector: 'app-scan',
  imports: [ReactiveFormsModule],
  templateUrl: './scan.component.html',
  styleUrl: './scan.component.css',
})
export class ScanComponent implements OnDestroy {
  private gamesApi = inject(GameService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private zone = inject(NgZone);
  private scanner?: Html5Qrcode;
  private lastCode = '';

  readonly form = this.formBuilder.nonNullable.group({
    barcode: [''],
    query: [''],
  });
  readonly candidates = signal<GameDraft[]>([]);
  readonly barcode = signal('');
  readonly message = signal('');
  readonly trace = signal<string[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly cameraOn = signal(false);

  async startCamera() {
    this.error.set('');
    const elementId = 'reader';
    this.scanner = new Html5Qrcode(elementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ],
      verbose: false,
    });
    try {
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 260, height: 140 } },
        (code) => this.zone.run(() => this.onCode(code)),
        () => undefined,
      );
      this.cameraOn.set(true);
    } catch {
      this.error.set('Nie udało się włączyć aparatu. Wpisz kod ręcznie.');
    }
  }

  async ngOnDestroy() {
    await this.stopCamera();
  }

  lookupBarcode() {
    this.lastCode = '';
    this.onCode(this.form.controls.barcode.value, true);
  }

  searchName() {
    const query = this.form.controls.query.value.trim();
    if (query.length < 2) {
      this.error.set('Wpisz co najmniej 2 znaki nazwy.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.trace.set([]);
    this.candidates.set([]);
    this.barcode.set('');
    this.gamesApi.search(query).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.candidates.set(result.candidates);
        this.message.set(result.candidates.length ? `Znaleziono ${result.candidates.length}.` : 'Brak gier dla tej nazwy. Sprawdź klucz RAWG.');
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(error.error?.message || 'Nie udało się wyszukać gry.');
      },
    });
  }

  add(draft: GameDraft) {
    this.busy.set(true);
    this.gamesApi.add(draft, this.barcode()).subscribe({
      next: (result) => this.router.navigate(['/game', result.game._id]),
      error: (error) => {
        this.busy.set(false);
        this.error.set(error.error?.message || 'Nie udało się dodać gry.');
      },
    });
  }

  private onCode(value: string, manual = false) {
    const barcode = value.replace(/\D/g, '');
    if (barcode.length < 8) {
      if (manual) this.error.set('Kod jest za krótki. Zeskanuj cały kod z pudełka.');
      return;
    }
    if (!manual && (barcode === this.lastCode || this.busy())) return;
    this.lastCode = barcode;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.trace.set([]);
    this.candidates.set([]);
    this.barcode.set(barcode);
    this.form.controls.barcode.setValue(barcode);
    this.gamesApi.lookup(barcode).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.lastCode = '';
        const found = result.barcode || barcode;
        this.barcode.set(found);
        this.form.controls.barcode.setValue(found);
        this.trace.set(result.trace || []);
        if (result.already && result.game) {
          this.message.set('Ta gra jest już na półce. Otwieram ją.');
          this.router.navigate(['/game', result.game._id]);
          return;
        }
        this.candidates.set(result.candidates);
        this.message.set(result.candidates.length
          ? `Znaleziono ${result.candidates.length}. Wybierz właściwe wydanie.`
          : 'Żadna baza nie rozpoznała tego kodu. Wpisz nazwę z pudełka.');
      },
      error: (error) => {
        this.busy.set(false);
        this.lastCode = '';
        this.error.set(error.error?.message || 'Nie udało się odczytać kodu. API nie odpowiedziało.');
      },
    });
  }

  private async stopCamera() {
    if (!this.scanner || !this.cameraOn()) return;
    await this.scanner.stop().catch(() => undefined);
    this.scanner.clear();
  }
}
