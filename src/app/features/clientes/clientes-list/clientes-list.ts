import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { Cliente, ClienteDeudaVieja } from '../../../core/models/cliente.model';
import { Barrio, DIAS_SEMANA, DiaSemana, diaDeHoy } from '../../../core/models/barrio.model';

type FiltroDia = DiaSemana | 'restaurantes' | '';

@Component({
  selector: 'app-clientes-list',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './clientes-list.html',
  styleUrl: './clientes-list.css',
})
export default class ClientesList implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private router = inject(Router);

  dias = DIAS_SEMANA.filter((d) => d.valor !== 'domingo');

  clientes = signal<Cliente[]>([]);
  barrios = signal<Barrio[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  busqueda = signal('');

  diaSeleccionado = signal<FiltroDia>(this.calcularDiaInicial());

  deudaVieja = signal<ClienteDeudaVieja[]>([]);
  filtroDeudaViejaActivo = signal(false);
  limiteVisible = signal(5);

  private calcularDiaInicial(): FiltroDia {
    const hoy = diaDeHoy();
    return hoy === 'domingo' ? '' : hoy;
  }

  ngOnInit() {
    this.cargarClientes();
    this.barrioService.listar().subscribe({ next: (data) => this.barrios.set(data) });
    this.clienteService.listarDeudaVieja().subscribe({
      next: (data) => this.deudaVieja.set(data),
    });
  }

  toggleFiltroDeudaVieja() {
    this.filtroDeudaViejaActivo.update((v) => !v);
    this.limiteVisible.set(5);
  }

  onBusqueda(texto: string) {
    this.busqueda.set(texto);
    this.limiteVisible.set(5);
  }

  cambiarDia(dia: FiltroDia) {
    this.diaSeleccionado.set(dia);
    this.limiteVisible.set(5);
  }

  verMas() {
    this.limiteVisible.update((val) => val + 15);
  }

  cargarClientes() {
    this.cargando.set(true);
    this.clienteService.listar().subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los clientes');
        this.cargando.set(false);
      },
    });
  }

  private diasDelCliente(c: Cliente): DiaSemana[] {
    const barrio = this.barrios().find((b) => b.id === c.barrioId);
    return (barrio?.diasVisita as DiaSemana[]) ?? [];
  }

  get clientesFiltrados(): Cliente[] {
    if (this.filtroDeudaViejaActivo()) {
      const idsConDeuda = new Set(this.deudaVieja().map((d) => d.id));
      return this.clientes()
        .filter((c) => idsConDeuda.has(c.id))
        .sort((a, b) => {
          const diasA = this.deudaVieja().find((d) => d.id === a.id)?.diasSinPagar ?? 0;
          const diasB = this.deudaVieja().find((d) => d.id === b.id)?.diasSinPagar ?? 0;
          return diasB - diasA;
        });
    }

    const texto = this.busqueda().toLowerCase().trim();
    const filtro = this.diaSeleccionado();

    return this.clientes().filter((c) => {
      const coincideTexto = !texto || `${c.nombre} ${c.apellido}`.toLowerCase().includes(texto);

      let coincideFiltro: boolean;
      if (filtro === '') {
        coincideFiltro = true;
      } else if (filtro === 'restaurantes') {
        coincideFiltro = c.categoria === 'restaurante';
      } else {
        coincideFiltro = this.diasDelCliente(c).includes(filtro);
      }

      return coincideTexto && coincideFiltro;
    });
  }

  get clientesMostrados(): Cliente[] {
    return this.clientesFiltrados.slice(0, this.limiteVisible());
  }

  get hayMasClientes(): boolean {
    return this.clientesFiltrados.length > this.limiteVisible();
  }

  get cantidadRestante(): number {
    return Math.max(0, this.clientesFiltrados.length - this.clientesMostrados.length);
  }

  tieneEnvasesPendientes(cliente: Cliente): boolean {
    return !!cliente.saldosEnvase?.some((s) => s.cantidad > 0);
  }

  irADetalle(id: string) {
    this.router.navigate(['/clientes', id]);
  }

  llamar(event: Event, telefono: string) {
    event.stopPropagation();
  }

  private fechaHoy(): string {
    return new Date().toISOString().split('T')[0];
  }

  visitadoHoy(cliente: Cliente): boolean {
    return cliente.ultimaVisitaFecha === this.fechaHoy();
  }

  toggleVisitado(event: Event, cliente: Cliente) {
    event.stopPropagation(); // evita que el click navegue al detalle

    const nuevoEstado = !this.visitadoHoy(cliente);

    this.clienteService.marcarVisita(cliente.id, nuevoEstado).subscribe({
      next: (actualizado) => {
        this.clientes.update((lista) =>
          lista.map((c) => (c.id === actualizado.id ? actualizado : c))
        );
      },
      error: () => {
        this.error.set('No se pudo actualizar el estado de visita');
      },
    });
  }
}
