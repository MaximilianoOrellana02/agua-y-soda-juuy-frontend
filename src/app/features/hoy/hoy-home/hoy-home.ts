import { Component, inject, OnInit, signal } from '@angular/core';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { ResumenHoy } from '../../../core/models/historial.model';
import { Cliente } from '../../../core/models/cliente.model';
import { HistorialService } from '../../../core/services/historial.service';
import { forkJoin } from 'rxjs';
import { diaDeHoy, DiaSemana, Barrio } from '../../../core/models/barrio.model';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import RutaMapaModal from '../../../shared/ruta-mapa-modal/ruta-mapa-modal';

@Component({
  selector: 'app-hoy-home',
  imports: [RouterLink, DecimalPipe, RutaMapaModal],
  templateUrl: './hoy-home.html',
  styleUrl: './hoy-home.css',
})
export default class HoyHome implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private historialService = inject(HistorialService);

  cargando = signal(true);
  error = signal<string | null>(null);
  resumen = signal<ResumenHoy | null>(null);
  paradasHoy = signal<Cliente[]>([]);
  paradasPendientes = signal<Cliente[]>([]);
  mostrarMapa = signal(false);
  incluirRestaurantes = signal(false);

  private clientesCargados: Cliente[] = [];
  private barriosCargados: Barrio[] = [];

  fechaHoyTexto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  ngOnInit() {
    this.cargarEstadoRestaurantes();
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);

    forkJoin({
      clientes: this.clienteService.listar(),
      barrios: this.barrioService.listar(),
      resumen: this.historialService.resumenHoy(),
    }).subscribe({
      next: ({ clientes, barrios, resumen }) => {
        this.clientesCargados = clientes;
        this.barriosCargados = barrios;
        this.actualizarListado();
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el resumen de hoy');
        this.cargando.set(false);
      },
    });
  }

  toggleRestaurantes() {
    const nuevoEstado = !this.incluirRestaurantes();
    this.incluirRestaurantes.set(nuevoEstado);
    this.guardarEstadoRestaurantes(nuevoEstado);
    this.actualizarListado();
  }

  private actualizarListado() {
    const hoy = diaDeHoy();
    const incluirRest = this.incluirRestaurantes();

    const deHoy = this.clientesCargados.filter((c) => {
      const barrio = this.barriosCargados.find((b) => b.id === c.barrioId);
      const tocaHoy = (barrio?.diasVisita as DiaSemana[] | undefined)?.includes(hoy) ?? false;
      const esRestaurante = c.categoria === 'restaurante';
      return tocaHoy || (incluirRest && esRestaurante);
    });

    this.paradasHoy.set(deHoy);
    this.paradasPendientes.set(
      deHoy.filter((c) => c.ultimaVisitaFecha !== this.fechaHoyISO())
    );
  }

  private cargarEstadoRestaurantes() {
    try {
      const guardado = localStorage.getItem('hoy_restaurantes_' + this.fechaHoyISO());
      if (guardado === 'true') {
        this.incluirRestaurantes.set(true);
      }
    } catch (e) { }
  }

  private guardarEstadoRestaurantes(activo: boolean) {
    try {
      localStorage.setItem('hoy_restaurantes_' + this.fechaHoyISO(), String(activo));
    } catch (e) { }
  }

  private fechaHoyISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  visitadasHoy(): number {
    return this.paradasHoy().length - this.paradasPendientes().length;
  }

  progresoPorcentaje(): number {
    const total = this.paradasHoy().length;
    if (total === 0) return 0;
    return Math.round((this.visitadasHoy() / total) * 100);
  }

  abrirMapa() {
    this.mostrarMapa.set(true);
  }

  cerrarMapa() {
    this.mostrarMapa.set(false);
  }

  compartirRuta() {
    const texto = this.armarTextoRuta();

    if (navigator.share) {
      navigator.share({ title: 'Ruta de Hoy', text: texto }).catch(() => { });
      return;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        alert(
          'No se pudo abrir el menú de compartir, pero copié la ruta al portapapeles. Pegala donde quieras.',
        );
      });
      return;
    }

    alert(
      'Tu navegador no permite compartir automáticamente en este modo. Probá copiando el texto manualmente:\n\n' +
      texto,
    );
  }

  private armarTextoRuta(): string {
    const lista = this.paradasPendientes();

    const lineas = lista.map((c, i) => {
      const direccion = c.direccion ? `\n📍 ${c.direccion}` : '';
      const telefono = c.telefono ? `\n📞 ${c.telefono}` : '';
      const deuda = c.saldoActual > 0 ? `\n💰 Debe $${c.saldoActual}` : '';
      return `${i + 1}. ${c.apellido}, ${c.nombre}${direccion}${telefono}${deuda}`;
    });

    return `🚚 Ruta de Hoy (${this.fechaHoyTexto})\n\n${lineas.join('\n\n')}\n\nTotal paradas pendientes: ${lista.length}`;
  }
}
