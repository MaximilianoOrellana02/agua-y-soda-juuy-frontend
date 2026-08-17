import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-recuperar-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css',
})
export default class RecuperarPassword {
  private authService = inject(AuthService);

  email = '';
  enviando = signal(false)
  enviado = signal(false);
  error = signal<string | null>(null)

  enviar() {
    if (!this.email) {
      this.error.set('Ingresá tu email')
      return;
    }
    this.enviando.set(true);
    this.error.set(null);

    this.authService.solicitarRecuperacion(this.email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: () => {
        this.enviando.set(false);
        this.error.set('Ocurrió un error. Intentá de nuevo.');
      },
    });
  }
}
