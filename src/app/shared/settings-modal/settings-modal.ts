import { Component, inject, output, signal } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Vista = 'menu' | 'password';

@Component({
  selector: 'app-settings-modal',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings-modal.html',
  styleUrl: './settings-modal.css',
})
export default class SettingsModal {
  themeService = inject(ThemeService);
  authService = inject(AuthService);

  cerrar = output<void>();
  vista = signal<Vista>('menu');

  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal(false);
  verPassword = signal(false);

  toggleTheme() {
    this.themeService.toggle();
  }

  logout() {
    this.authService.logout();
    this.cerrar.emit();
  }

  irAPassword() {
    this.vista.set('password');
    this.error.set(null);
    this.exito.set(false);
    this.verPassword.set(false);
    this.passwordActual = '';
    this.passwordNueva = '';
    this.passwordConfirmar = '';
  }

  togglePassword() {
    this.verPassword.update((v) => !v);
  }

  volverAlMenu() {
    this.vista.set('menu');
  }

  guardarPassword() {
    if (!this.passwordActual || !this.passwordNueva || !this.passwordConfirmar) {
      this.error.set('Completá todos los campos');
      return;
    }

    if (this.passwordNueva.length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.passwordNueva !== this.passwordConfirmar) {
      this.error.set('Las contraseñas nuevas no coinciden');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    this.authService.cambiarPassword(this.passwordActual, this.passwordNueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set(true);
        this.passwordActual = '';
        this.passwordNueva = '';
        this.passwordConfirmar = '';
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.error ?? 'No se pudo cambiar la contraseña');
      },
    });
  }
}
