import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BarrioService } from '../../../core/services/barrio.service';
import { Barrio, DIAS_SEMANA, DiaSemana } from '../../../core/models/barrio.model';

@Component({
  selector: 'app-barrios-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './barrios-list.html',
  styleUrl: './barrios-list.css',
})
export default class BarriosList implements OnInit {
  private barrioService = inject(BarrioService);

  dias = DIAS_SEMANA;
  barrios = signal<Barrio[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  editandoId = signal<string | null>(null);
  nombreNuevo = '';
  diasSeleccionNuevo = signal<Set<DiaSemana>>(new Set());
  diasSeleccionEdicion = signal<Set<DiaSemana>>(new Set());
  agregando = signal(false);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.barrioService.listar().subscribe({
      next: (data) => {
        this.barrios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los barrios');
        this.cargando.set(false);
      },
    });
  }

  toggleDiaNuevo(dia: DiaSemana) {
    const set = new Set(this.diasSeleccionNuevo());
    set.has(dia) ? set.delete(dia) : set.add(dia);
    this.diasSeleccionNuevo.set(set);
  }

  agregar() {
    if (!this.nombreNuevo.trim()) return;

    this.agregando.set(true);
    this.error.set(null);

    this.barrioService
      .crear(this.nombreNuevo.trim())
      .subscribe({
        next: (barrio) => {
          const dias = Array.from(this.diasSeleccionNuevo());
          if (dias.length > 0) {
            this.barrioService.actualizar(barrio.id, { diasVisita: dias }).subscribe({
              next: (actualizado) => this.agregarALista(actualizado),
            });
          } else {
            this.agregarALista(barrio);
          }
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'No se pudo crear el barrio');
          this.agregando.set(false);
        },
      });
  }

  private agregarALista(barrio: Barrio) {
    this.barrios.update((lista) => [...lista, barrio].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    this.nombreNuevo = '';
    this.diasSeleccionNuevo.set(new Set());
    this.agregando.set(false);
  }

  editar(barrio: Barrio) {
    this.editandoId.set(barrio.id);
    this.diasSeleccionEdicion.set(new Set(barrio.diasVisita));
  }

  toggleDiaEdicion(dia: DiaSemana) {
    const set = new Set(this.diasSeleccionEdicion());
    set.has(dia) ? set.delete(dia) : set.add(dia);
    this.diasSeleccionEdicion.set(set);
  }

  guardarEdicion(barrio: Barrio) {
    const dias = Array.from(this.diasSeleccionEdicion());
    this.barrioService.actualizar(barrio.id, { diasVisita: dias }).subscribe({
      next: (actualizado) => {
        this.barrios.update((lista) => lista.map((b) => (b.id === actualizado.id ? actualizado : b)));
        this.editandoId.set(null);
      },
      error: () => this.error.set('No se pudo guardar'),
    });
  }

  cancelarEdicion() {
    this.editandoId.set(null);
  }

  eliminar(barrio: Barrio) {
    if (!confirm(`¿Eliminar el barrio "${barrio.nombre}"? Los clientes asignados quedarán sin barrio.`)) return;

    this.barrioService.eliminar(barrio.id).subscribe({
      next: () => this.barrios.update((lista) => lista.filter((b) => b.id !== barrio.id)),
      error: () => this.error.set('No se pudo eliminar el barrio'),
    });
  }

  etiquetaDias(dias: DiaSemana[]): string {
    if (dias.length === 0) return 'Sin días asignados';
    return dias.map((d) => this.dias.find((x) => x.valor === d)?.etiqueta.slice(0, 3)).join(', ');
  }
}