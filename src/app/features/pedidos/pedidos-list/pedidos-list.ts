import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PedidoService } from '../../../core/services/pedido.service';
import { ClienteService } from '../../../core/services/cliente.service';
import { Pedido } from '../../../core/models/pedido.model';
import { Cliente } from '../../../core/models/cliente.model';

@Component({
  selector: 'app-pedidos-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './pedidos-list.html',
  styleUrl: './pedidos-list.css',
})
export default class PedidosList implements OnInit {
  private pedidoService = inject(PedidoService);
  private clienteService = inject(ClienteService);
  private router = inject(Router);

  pedidos = signal<Pedido[]>([]);
  clientes = signal<Cliente[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  mostrarForm = signal(false);
  clienteSeleccionado = signal<Cliente | null>(null);
  busquedaCliente = signal('');
  clienteIdNuevo = '';
  detalleNuevo = '';
  guardando = signal(false);

  clientesFiltrados = computed(() => {
    const q = this.busquedaCliente().toLowerCase().trim();
    const lista = this.clientes();
    if (!q) {
      return lista.slice(0, 10);
    }
    return lista.filter((c) => {
      const nombreCompleto = `${c.nombre} ${c.apellido}`.toLowerCase();
      const apellidoNombre = `${c.apellido} ${c.nombre}`.toLowerCase();
      const direccion = (c.direccion || '').toLowerCase();
      return nombreCompleto.includes(q) || apellidoNombre.includes(q) || direccion.includes(q);
    }).slice(0, 15);
  });

  ngOnInit() {
    this.cargar();
    this.clienteService.listar().subscribe({ next: (data) => this.clientes.set(data) });
  }

  cargar() {
    this.cargando.set(true);
    this.pedidoService.listarPendientes().subscribe({
      next: (data) => {
        this.pedidos.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los pedidos');
        this.cargando.set(false);
      },
    });
  }

  toggleForm() {
    const estado = !this.mostrarForm();
    this.mostrarForm.set(estado);
    if (!estado) {
      this.resetForm();
    }
  }

  seleccionarCliente(c: Cliente) {
    this.clienteSeleccionado.set(c);
    this.clienteIdNuevo = c.id;
    this.busquedaCliente.set('');
    this.error.set(null);
  }

  deseleccionarCliente() {
    this.clienteSeleccionado.set(null);
    this.clienteIdNuevo = '';
  }

  resetForm() {
    this.clienteSeleccionado.set(null);
    this.clienteIdNuevo = '';
    this.busquedaCliente.set('');
    this.detalleNuevo = '';
    this.error.set(null);
  }

  nombreCliente(cliente?: { nombre: string; apellido?: string } | null): string {
    if (!cliente) return 'Cliente';
    if (cliente.apellido && cliente.nombre) {
      return `${cliente.apellido}, ${cliente.nombre}`;
    }
    return cliente.nombre || cliente.apellido || 'Cliente';
  }

  agregar() {
    if (!this.clienteIdNuevo) {
      this.error.set('Elegí un cliente');
      return;
    }

    const clienteSel = this.clienteSeleccionado() || this.clientes().find((c) => c.id === this.clienteIdNuevo);
    this.guardando.set(true);
    this.error.set(null);

    const detalle = this.detalleNuevo.trim();

    this.pedidoService.crear(this.clienteIdNuevo, detalle).subscribe({
      next: (pedido) => {
        const pedidoCompleto: Pedido = {
          ...pedido,
          detalle: pedido.detalle ?? (detalle || null as any),
          cliente: pedido.cliente || (clienteSel ? {
            id: clienteSel.id,
            nombre: clienteSel.nombre,
            apellido: clienteSel.apellido,
            telefono: clienteSel.telefono,
          } : undefined),
        };
        this.pedidos.update((lista) => [...lista, pedidoCompleto]);
        this.resetForm();
        this.mostrarForm.set(false);
        this.guardando.set(false);
      },
      error: () => {
        this.error.set('No se pudo crear el pedido');
        this.guardando.set(false);
      },
    });
  }

  marcarEntregado(pedido: Pedido) {
    this.pedidoService.marcarEntregado(pedido.id).subscribe({
      next: () => {
        this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id));
      },
      error: () => this.error.set('No se pudo marcar como entregado'),
    });
  }

  eliminar(pedido: Pedido) {
    if (!confirm('¿Cancelar este pedido?')) return;
    this.pedidoService.eliminar(pedido.id).subscribe({
      next: () => this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id)),
      error: () => this.error.set('No se pudo eliminar el pedido'),
    });
  }

  irAEntregar(pedido: Pedido) {
    this.router.navigate(['/clientes', pedido.clienteId, 'entrega'], {
      queryParams: { pedidoId: pedido.id },
      state: { detallePedido: pedido.detalle },
    });
  }
}
