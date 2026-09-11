import { Component, inject, OnInit, signal } from '@angular/core';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { ResumenHoy } from '../../../core/models/historial.model';
import { Cliente } from '../../../core/models/cliente.model';
import { HistorialService } from '../../../core/services/historial.service';
import { finalize, forkJoin } from 'rxjs';
import { diaDeHoy, DiaSemana, Barrio } from '../../../core/models/barrio.model';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import RutaMapaModal from '../../../shared/ruta-mapa-modal/ruta-mapa-modal';
import { NotificationService } from '../../../core/services/notification.service';

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
  private notificationService = inject(NotificationService);

  cargando = signal(true);
  error = signal<string | null>(null);
  guardandoVisitaId = signal<string | null>(null);
  resumen = signal<ResumenHoy | null>(null);
  paradasHoy = signal<Cliente[]>([]);
  paradasPendientes = signal<Cliente[]>([]);
  paradasRealizadas = signal<Cliente[]>([]);
  mostrarMapa = signal(false);
  incluirRestaurantes = signal(false);
  mostrarDetalleCobrado = signal(false);
  mostrarDetalleEntregados = signal(false);

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

  marcarVisitado(cliente: Cliente) {
    if (this.guardandoVisitaId() !== null) return;

    this.notificationService.confirmar(
      `¿Marcar a ${cliente.nombre} ${cliente.apellido}?`,
      'Se quitará de las paradas pendientes sin registrar entregas ni cobros.',
      () => this.confirmarVisita(cliente),
      'Sí, marcar',
    );
  }

  private confirmarVisita(cliente: Cliente) {
    this.guardandoVisitaId.set(cliente.id);
    this.clienteService.marcarVisita(cliente.id, true)
      .pipe(finalize(() => this.guardandoVisitaId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.clientesCargados = this.clientesCargados.map((c) =>
            c.id === cliente.id ? { ...c, ultimaVisitaFecha: actualizado.ultimaVisitaFecha } : c
          );
          this.actualizarListado();
        },
        error: () => {
          this.notificationService.mostrar(
            `No se pudo marcar a ${cliente.nombre} ${cliente.apellido} como visitado. Intentá nuevamente.`
          );
        },
      });
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

    const fechaHoy = this.fechaHoyISO();
    this.paradasHoy.set(deHoy);
    this.paradasPendientes.set(deHoy.filter((c) => c.ultimaVisitaFecha !== fechaHoy));
    this.paradasRealizadas.set(
      this.clientesCargados.filter((c) => c.ultimaVisitaFecha === fechaHoy)
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
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)!.value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  visitadasHoy(): number {
    return this.paradasHoy().length - this.paradasPendientes().length;
  }

  progresoPorcentaje(): number {
    const total = this.paradasHoy().length;
    if (total === 0) return 0;
    return Math.round((this.visitadasHoy() / total) * 100);
  }

  toggleDetalleCobrado() {
    this.mostrarDetalleCobrado.update((abierto) => !abierto);
  }

  toggleDetalleEntregados() {
    this.mostrarDetalleEntregados.update((abierto) => !abierto);
  }

  productosEntregados() {
    return (this.resumen()?.productos ?? []).filter((producto) => producto.cantidad > 0);
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
        this.notificationService.mostrar(
          'Ruta copiada al portapapeles. Pegala donde quieras.',
          'success',
        );
      });
      return;
    }

    this.notificationService.mostrar(
      'Tu navegador no permite compartir ni copiar la ruta automáticamente.',
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
