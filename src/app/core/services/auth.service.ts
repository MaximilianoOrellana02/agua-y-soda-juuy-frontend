import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environments';

interface LoginResponse {
  token: string;
  usuario: {
    id: string;
    username: string;
    nombreCompleto: string;
    email?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private esNavegador = isPlatformBrowser(this.platformId);

  usuarioActual = signal<LoginResponse['usuario'] | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    if (this.esNavegador) {
      const guardado = localStorage.getItem('usuario');
      if (guardado) {
        this.usuarioActual.set(JSON.parse(guardado));
      }
    }
  }

  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/usuarios/login`, {
      username,
      password,
    });
  }

  guardarSesion(respuesta: LoginResponse) {
    if (this.esNavegador) {
      localStorage.setItem('token', respuesta.token);
      localStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    }
    this.usuarioActual.set(respuesta.usuario);
  }

  logout() {
    if (this.esNavegador) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
    this.usuarioActual.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.esNavegador ? localStorage.getItem('token') : null;
  }

  estaLogueado(): boolean {
    return !!this.getToken();
  }

  cambiarPassword(passwordActual: string, passwordNueva: string) {
    return this.http.put<{ mensaje: string }>(`${environment.apiUrl}/usuarios/password`, {
      passwordActual,
      passwordNueva,
    });
  }

  solicitarRecuperacion(email: string) {
    return this.http.post<{ mensage: string }>(`${environment.apiUrl}/usuarios/recuperar`, { email })
  }

  restablecerPassword(token: string, passwordNueva: string) {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/usuarios/restablecer`, {
      token,
      passwordNueva,
    });
  }
}
