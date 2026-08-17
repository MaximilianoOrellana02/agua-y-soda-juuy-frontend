import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import SettingsModal from '../shared/settings-modal/settings-modal';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SettingsModal],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export default class Shell {
  authService = inject(AuthService);
  mostrarConfiguracion = signal(false);

  abrirConfiguracion() {
    this.mostrarConfiguracion.set(true);
  }

  cerrarConfiguracion() {
    this.mostrarConfiguracion.set(false);
  }
}
