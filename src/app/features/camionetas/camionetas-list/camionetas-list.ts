import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CamionetaService } from '../../../core/services/camioneta.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Camioneta } from '../../../core/models/camioneta.model';

@Component({
  selector: 'app-camionetas-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './camionetas-list.html',
  styleUrl: '../camionetas.css',
})
export default class CamionetasList implements OnInit {
  authService = inject(AuthService);
  camionetaService = inject(CamionetaService);
  private notificationService = inject(NotificationService);

  camionetas = signal<Camioneta[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  // Alta / edición (solo admin)
  editandoId = signal<string | null>(null);
  mostrarFormulario = signal(false);
  guardando = signal(false);
  errorFormulario = signal<string | null>(null);
  form = { nombre: '', patente: '', activa: true };

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.camionetaService.listar(this.authService.esAdmin()).subscribe({
      next: (data) => {
        this.camionetas.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'No se pudieron cargar las camionetas');
        this.cargando.set(false);
      },
    });
  }

  // La camioneta del día se elige desde el indicador de la barra superior; acá solo se marca.
  esLaDeHoy(camioneta: Camioneta): boolean {
    return this.camionetaService.camionetaDelDia()?.id === camioneta.id;
  }

  abrirAlta() {
    this.editandoId.set(null);
    this.form = { nombre: '', patente: '', activa: true };
    this.errorFormulario.set(null);
    this.mostrarFormulario.set(true);
  }

  abrirEdicion(camioneta: Camioneta) {
    this.editandoId.set(camioneta.id);
    this.form = { nombre: camioneta.nombre, patente: camioneta.patente ?? '', activa: camioneta.activa };
    this.errorFormulario.set(null);
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario() {
    this.mostrarFormulario.set(false);
  }

  guardar() {
    const nombre = this.form.nombre.trim();
    if (!nombre) {
      this.errorFormulario.set('El nombre es obligatorio');
      return;
    }
    const datos = { nombre, patente: this.form.patente.trim() || null, activa: this.form.activa };
    const id = this.editandoId();
    const llamada = id ? this.camionetaService.actualizar(id, datos) : this.camionetaService.crear(datos);

    this.guardando.set(true);
    this.errorFormulario.set(null);
    llamada.subscribe({
      next: (camioneta) => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);
        // Si se desactivó la camioneta del día, deja de valer para las entregas.
        if (this.esLaDeHoy(camioneta) && !camioneta.activa) this.camionetaService.camionetaDelDia.set(null);
        this.notificationService.mostrar(`Camioneta ${camioneta.nombre} guardada.`, 'success');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorFormulario.set(
          err.status === 409 ? 'Ya existe una camioneta con ese nombre' : err.error?.error ?? 'No se pudo guardar la camioneta',
        );
      },
    });
  }
}
