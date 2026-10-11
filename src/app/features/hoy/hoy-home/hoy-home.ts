import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { ResumenHoy } from '../../../core/models/historial.model';
import { Cliente } from '../../../core/models/cliente.model';
import { HistorialService } from '../../../core/services/historial.service';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { Barrio } from '../../../core/models/barrio.model';
import { calcularParadas, guardarRestaurantesIncluidosHoy, restaurantesIncluidosHoy } from '../../../shared/paradas-hoy.util';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import RutaMapaModal from '../../../shared/ruta-mapa-modal/ruta-mapa-modal';
import { NotificationService } from '../../../core/services/notification.service';
import { RepartoService } from '../../../core/services/reparto.service';
import { CamionetaService } from '../../../core/services/camioneta.service';
import { PedidoService } from '../../../core/services/pedido.service';
import { Pedido } from '../../../core/models/pedido.model';

// Minúsculas y sin acentos, para que "gomez" encuentre "Gómez".
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

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
  repartoService = inject(RepartoService);
  camionetaService = inject(CamionetaService);
  private pedidoService = inject(PedidoService);

  // Lo que lleva la camioneta del día (sin los productos en 0), para la tarjeta de arriba.
  stockEnCamioneta = computed(() =>
    (this.camionetaService.stockDelDia() ?? [])
      .filter((s) => s.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad),
  );
  totalEnCamioneta = computed(() => this.stockEnCamioneta().reduce((acc, s) => acc + s.cantidad, 0));

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
  terminando = signal(false);

  // Buscador: filtra solo las listas; progreso y "Terminar reparto" siguen contando todas las paradas.
  busqueda = signal('');
  private pedidosPorCliente = signal(new Map<string, string[]>());
  private termino = computed(() => normalizar(this.busqueda()));
  pendientesFiltradas = computed(() => this.paradasPendientes().filter((c) => this.coincide(c)));
  realizadasFiltradas = computed(() => this.paradasRealizadas().filter((c) => this.coincide(c)));

  private clientesCargados: Cliente[] = [];
  private barriosCargados: Barrio[] = [];

  fechaHoyTexto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  private coincide(c: Cliente): boolean {
    const termino = this.termino();
    if (!termino) return true;
    const datos = [c.nombre, c.apellido, `${c.nombre} ${c.apellido}`, c.direccion, c.localidad, ...(this.pedidosPorCliente().get(c.id) ?? [])];
    return datos.some((dato) => dato && normalizar(dato).includes(termino));
  }

  // Con búsqueda activa, muestra el pedido pendiente que coincide (así se entiende por qué aparece la parada).
  pedidoQueCoincide(c: Cliente): string | null {
    const termino = this.termino();
    if (!termino) return null;
    return (this.pedidosPorCliente().get(c.id) ?? []).find((detalle) => normalizar(detalle).includes(termino)) ?? null;
  }

  ngOnInit() {
    this.cargarEstadoRestaurantes();
    this.cargar();
    this.cargarCamioneta();
  }

  // Se vuelve a consultar al entrar: si la app quedó abierta de un día para otro, la camioneta de ayer ya no vale,
  // y las entregas fueron descontando su stock.
  private cargarCamioneta() {
    this.camionetaService
      .cargarCamionetaDelDia()
      .pipe(switchMap(() => this.camionetaService.refrescarStockDelDia()))
      .subscribe({ error: () => {} });
    this.repartoService.cargarRepartoHoy().subscribe({ error: () => {} });
  }

  // Se habilita cuando no quedan paradas pendientes; cierra el día y muestra el resumen.
  terminarReparto() {
    if (this.terminando() || this.paradasPendientes().length > 0) return;
    this.notificationService.confirmar(
      'Terminar reparto',
      'Se cierra el reparto de hoy y se muestra el resumen del día.',
      () => this.confirmarTerminar(),
      'Terminar',
    );
  }

  private confirmarTerminar() {
    this.terminando.set(true);
    this.repartoService
      .terminar()
      .pipe(finalize(() => this.terminando.set(false)))
      .subscribe({
        next: () => this.repartoService.abrirResumen(),
        error: (err) => this.notificationService.mostrar(err.error?.error ?? 'No se pudo terminar el reparto'),
      });
  }

  cargar() {
    this.cargando.set(true);

    forkJoin({
      clientes: this.clienteService.listar(),
      barrios: this.barrioService.listar(),
      resumen: this.historialService.resumenHoy(),
      // Solo alimenta al buscador: si falla, Hoy se muestra igual.
      pedidos: this.pedidoService.listarPendientes().pipe(catchError(() => of([] as Pedido[]))),
    }).subscribe({
      next: ({ clientes, barrios, resumen, pedidos }) => {
        const porCliente = new Map<string, string[]>();
        for (const p of pedidos) porCliente.set(p.clienteId, [...(porCliente.get(p.clienteId) ?? []), p.detalle]);
        this.pedidosPorCliente.set(porCliente);
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

  // El cálculo de la ruta es compartido con Clientes, para que "Parada N" coincida en las dos pantallas.
  private actualizarListado() {
    const { deHoy, pendientes, realizadas } = calcularParadas(
      this.clientesCargados,
      this.barriosCargados,
      this.incluirRestaurantes(),
    );
    this.paradasHoy.set(deHoy);
    this.paradasPendientes.set(pendientes);
    this.paradasRealizadas.set(realizadas);
  }

  private cargarEstadoRestaurantes() {
    if (restaurantesIncluidosHoy()) this.incluirRestaurantes.set(true);
  }

  private guardarEstadoRestaurantes(activo: boolean) {
    guardarRestaurantesIncluidosHoy(activo);
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
