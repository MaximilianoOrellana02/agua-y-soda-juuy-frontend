import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UsuarioService } from '../../../core/services/usuario.service';

@Component({
  selector: 'app-usuario-nuevo',
  imports: [FormsModule, RouterLink],
  templateUrl: './usuario-nuevo.html',
  styleUrl: './usuario-nuevo.css',
})
export default class UsuarioNuevo {
  private usuarioService = inject(UsuarioService);
  private router = inject(Router);

  guardando = signal(false)

  error = signal<string | null>(null);
  exito = signal(false);
  verPassword = signal(false);

  form = {
    username: '',
    password: '',
    passwordConfirmar: '',
    nombreCompleto: '',
    email: '',
  };

  togglePassword() {
    this.verPassword.update((v) => !v);
  }

  guardar() {
    if (!this.form.username || !this.form.password || !this.form.nombreCompleto || !this.form.email) {
      this.error.set('Completá todos los campos');
      return;
    }

    if (this.form.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.form.password !== this.form.passwordConfirmar) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    this.usuarioService
      .crearUsuario({
        username: this.form.username,
        password: this.form.password,
        nombreCompleto: this.form.nombreCompleto,
        email: this.form.email,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.exito.set(true);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo crear el usuario');
        },
      });
  }
}
