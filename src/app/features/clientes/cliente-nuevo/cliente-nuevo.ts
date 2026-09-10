import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteService } from '../../../core/services/cliente.service';
import { CategoriaCliente, TipoCliente } from '../../../core/models/cliente.model';
import { BarrioService } from '../../../core/services/barrio.service';
import { Barrio } from '../../../core/models/barrio.model';
import MapaCliente from '../../../shared/mapa-cliente/mapa-cliente';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-cliente-nuevo',
  imports: [FormsModule, RouterLink, MapaCliente],
  templateUrl: './cliente-nuevo.html',
  styleUrl: './cliente-nuevo.css',
})
export default class ClienteNuevo implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);

  private router = inject(Router);

  barrios = signal<Barrio[]>([]);
  guardando = signal(false);
  error = signal<string | null>(null);
  mapaAbierto = signal(true);
  obteniendoUbicacion = signal(false);
  errorUbicacion = signal<string | null>(null);

  toggleMapa() {
    this.mapaAbierto.update((v) => !v);
  }

  onPosicionCambiada(pos: { latitud: number; longitud: number }) {
    this.form.latitud = pos.latitud;
    this.form.longitud = pos.longitud;
    this.errorUbicacion.set(null);
  }

  async usarMiUbicacion() {
    if (this.obteniendoUbicacion()) return;

    this.obteniendoUbicacion.set(true);
    this.errorUbicacion.set(null);

    try {
      let latitud: number;
      let longitud: number;

      if (Capacitor.isNativePlatform()) {
        const posicion = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        latitud = posicion.coords.latitude;
        longitud = posicion.coords.longitude;
      } else {
        const posicion = await this.obtenerUbicacionDelNavegador();
        latitud = posicion.coords.latitude;
        longitud = posicion.coords.longitude;
      }

      this.form.latitud = latitud;
      this.form.longitud = longitud;
      this.mapaAbierto.set(true);
    } catch (error) {
      this.errorUbicacion.set(this.mensajeErrorUbicacion(error));
    } finally {
      this.obteniendoUbicacion.set(false);
    }
  }

  private obtenerUbicacionDelNavegador(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        reject(new Error('ubicacion-no-disponible'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      });
    });
  }

  private mensajeErrorUbicacion(error: unknown): string {
    const codigo = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    const mensaje = error instanceof Error ? error.message.toLowerCase() : '';
    if (codigo === '1' || mensaje.includes('denied') || mensaje.includes('permiso')) {
      return 'No se pudo acceder a tu ubicación. Habilitá el permiso de ubicación e intentá nuevamente.';
    }
    return 'No pudimos obtener tu ubicación. Verificá que el GPS esté activo e intentá nuevamente.';
  }

  form = {
    nombre: '',
    apellido: '',
    direccion: '',
    telefono: '',
    localidad: '',
    barrioId: '',
    categoria: 'domicilio' as CategoriaCliente,
    tipoCliente: 'particular' as TipoCliente,
    latitud: null as number | null,
    longitud: null as number | null,
  };

  ngOnInit(): void {
    this.barrioService.listar().subscribe({
      next: (data) => this.barrios.set(data),
    });
  }

  guardar() {
    if (!this.form.nombre || !this.form.apellido) {
      this.error.set('Nombre y apellido son obligatorios');
      return;
    }

    const resumen =
      `Crear cliente\n\n` +
      `Nombre: ${this.form.nombre} ${this.form.apellido}\n` +
      `Dirección: ${this.form.direccion || 'Sin registrar'}\n` +
      `Teléfono: ${this.form.telefono || 'Sin registrar'}\n` +
      `Localidad: ${this.form.localidad || 'Sin registrar'}\n` +
      `Tipo: ${this.form.tipoCliente === 'confianza' ? 'De confianza' : 'Particular'}\n\n` +
      `Barrio: ${this.barrios().find((b) => b.id === this.form.barrioId)?.nombre || 'Sin asignar'}\n` +
      `Categoría: ${this.form.categoria === 'restaurante' ? 'Restaurante' : 'Domicilio'}\n` +
      `¿Confirmás la creación?`;

    if (!confirm(resumen)) return;

    this.guardando.set(true);
    this.error.set(null);

    const payload = {
      ...this.form,
      barrioId: this.form.barrioId || undefined,
      latitud: this.form.latitud ?? undefined,
      longitud: this.form.longitud ?? undefined,
    };

    this.clienteService.crear(payload).subscribe({
      next: (cliente) => {
        this.router.navigate(['/clientes', cliente.id]);
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.error ?? 'No se pudo crear el cliente');
      },
    });
  }
}
