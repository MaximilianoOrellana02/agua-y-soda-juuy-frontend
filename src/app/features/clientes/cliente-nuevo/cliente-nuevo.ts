import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteService } from '../../../core/services/cliente.service';
import { CategoriaCliente, TipoCliente } from '../../../core/models/cliente.model';
import { BarrioService } from '../../../core/services/barrio.service';
import { Barrio } from '../../../core/models/barrio.model';
import MapaCliente from '../../../shared/mapa-cliente/mapa-cliente';

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

  toggleMapa() {
    this.mapaAbierto.update((v) => !v);
  }

  onPosicionCambiada(pos: { latitud: number; longitud: number }) {
    this.form.latitud = pos.latitud;
    this.form.longitud = pos.longitud;
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
      error: () => {
        this.guardando.set(false);
        this.error.set('No se pudo crear el cliente');
      },
    });
  }
}
