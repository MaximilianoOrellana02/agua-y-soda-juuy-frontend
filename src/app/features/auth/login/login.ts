import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export default class Login {
  private authService = inject(AuthService);
  private router = inject(Router);

  username: string = ''
  password: string = ''

  error = signal<string | null>(null);
  cargando = signal(false)
  mostrarPassword = signal(false);


  togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }


  onSubmit(): void {
    if (!this.username || !this.password) {
      this.error.set('Completá usuario y contraseña')
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.router.navigate(['./clientes'])
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.error ?? 'Error al iniciar sesión');
      },
    })
  }
}
