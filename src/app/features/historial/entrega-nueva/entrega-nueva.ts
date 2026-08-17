import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ClienteService } from '../../../core/services/cliente.service';
import { ProductoService } from '../../../core/services/producto.service';
import { HistorialService } from '../../../core/services/historial.service';
import { Cliente } from '../../../core/models/cliente.model';
import { Producto, precioVigente } from '../../../core/models/producto.model';
import { MetodoPago } from '../../../core/models/historial.model';

import * as QRCode from 'qrcode';
import { MercadopagoService } from '../../../core/services/mercadopago.service';

interface LineaEntrega {
  productoId: string;
  nombre: string;
  stockActual: number;
  cantidadEntregada: number;
  cantidadEnvaseDevuelto: number;
  precioUnitario: number;
  envasesPreviosCliente: number; // lo que el cliente ya tenía pendiente ANTES de esta entrega
}

@Component({
  selector: 'app-entrega-nueva',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './entrega-nueva.html',
  styleUrl: './entrega-nueva.css',
})
export default class EntregaNueva implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clienteService = inject(ClienteService);
  private productoService = inject(ProductoService);
  private historialService = inject(HistorialService);
  private mercadopagoService = inject(MercadopagoService)


  mpHabilitado = signal(false);
  mostrandoQR = signal(false);
  qrImagenUrl = signal<string | null>(null);
  verificandoPago = signal(false);
  private intervaloVerificacion?: ReturnType<typeof setInterval>;
  private referenciaActual = '';


  cliente = signal<Cliente | null>(null);
  lineas = signal<LineaEntrega[]>([]);
  observacion = '';
  opcionPago = signal<'todo' | 'nada' | 'otro'>('todo');
  montoPersonalizado = signal<number>(0);
  mostrarObservacion = signal(false);

  cargando = signal(true);
  guardando = signal(false);
  verificandoStock = signal(false);
  error = signal<string | null>(null);
  metodoPago = signal<MetodoPago>('efectivo');

  pedidoId: string | null = null;
  detallePedido: string | null = null

  importeTotal = computed(() =>
    this.lineas().reduce((acc, l) => acc + l.cantidadEntregada * l.precioUnitario, 0)
  );

  totalUnidades = computed(() =>
    this.lineas().reduce((acc, l) => acc + l.cantidadEntregada, 0)
  );

  montoPagado = computed(() => {
    if (this.opcionPago() === 'todo') {
      return this.importeTotal();
    } else if (this.opcionPago() === 'nada') {
      return 0;
    } else {
      return this.montoPersonalizado();
    }
  });

  seleccionarOpcionPago(opcion: 'todo' | 'nada' | 'otro') {
    this.opcionPago.set(opcion);
    if (opcion === 'otro' && this.montoPersonalizado() === 0) {
      this.montoPersonalizado.set(this.importeTotal());
    }
  }

  actualizarMontoPersonalizado(val: number | null) {
    this.montoPersonalizado.set(val ?? 0);
  }

  saldoAnterior = computed(() => Number(this.cliente()?.saldoActual ?? 0));

  saldoFinal = computed(
    () => this.saldoAnterior() + this.importeTotal() - this.montoPagado()
  );

  ngOnInit() {
    this.pedidoId = this.route.snapshot.queryParamMap.get('pedidoId');
    this.detallePedido = (history.state as any)?.detallePedido ?? null;

    const clienteId = this.route.snapshot.paramMap.get('clienteId');
    if (!clienteId) {
      this.error.set('Cliente no especificado');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    forkJoin({
      cliente: this.clienteService.obtenerCliente(clienteId),
      productos: this.productoService.listar(),
      envases: this.clienteService.obtenerSaldoEnvases(clienteId),
    }).subscribe({
      next: ({ cliente, productos, envases }) => {
        this.cliente.set(cliente);

        const envasesPorProducto = new Map(envases.map((e) => [e.productoId, e.cantidad]));

        this.lineas.set(
          productos.map((p: Producto) => ({
            productoId: p.id,
            nombre: p.nombre,
            stockActual: Number(p.stockActual),
            cantidadEntregada: 0,
            cantidadEnvaseDevuelto: 0,
            precioUnitario: precioVigente(p, cliente.tipoCliente) ?? 0,
            envasesPreviosCliente: envasesPorProducto.get(p.id) ?? 0,
          }))
        );
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los datos');
        this.cargando.set(false);
      },
    });

    this.mercadopagoService.habilitado().subscribe({
      next: (r) => this.mpHabilitado.set(r.habilitado),
    });
  }

  generarQR() {
    if (!this.hayMovimientos()) return;
    this.verificarStock(() => this.crearQR());
  }

  private async crearQR() {
    const cliente = this.cliente();
    if (!cliente) return;

    this.referenciaActual = `entrega-${cliente.id}-${Date.now()}`;

    this.mercadopagoService
      .crearPreferencia(this.importeTotal(), `Entrega a ${cliente.nombre} ${cliente.apellido}`, this.referenciaActual)
      .subscribe({
        next: async (pref) => {
          const link = pref.sandboxInitPoint || pref.initPoint; // sandbox mientras probás con credenciales de prueba
          const imagen = await QRCode.toDataURL(link, { width: 260 });
          this.qrImagenUrl.set(imagen);
          this.mostrandoQR.set(true);
          this.iniciarVerificacionPago();
        },
        error: () => {
          this.error.set('No se pudo generar el QR de pago');
        },
      });
  }

  private iniciarVerificacionPago() {
    this.verificandoPago.set(true);
    this.intervaloVerificacion = setInterval(() => {
      this.mercadopagoService.estadoPago(this.referenciaActual).subscribe({
        next: (r) => {
          if (r.pagado) {
            this.detenerVerificacionPago();
            this.opcionPago.set('todo');
            this.mostrandoQR.set(false);
            this.confirmar();
          }
        },
      });
    }, 3000);
  }

  private detenerVerificacionPago() {
    if (this.intervaloVerificacion) clearInterval(this.intervaloVerificacion);
    this.verificandoPago.set(false);
  }

  cancelarQR() {
    this.detenerVerificacionPago();
    this.mostrandoQR.set(false);
  }

  // Máximo que se puede devolver: lo que ya tenía + lo que se le entrega ahora mismo
  maxEnvasesDevolvibles(linea: LineaEntrega): number {
    return linea.envasesPreviosCliente + linea.cantidadEntregada;
  }

  sumar(linea: LineaEntrega) {
    if (linea.cantidadEntregada >= linea.stockActual) {
      this.error.set(`No hay stock suficiente de ${linea.nombre}. Disponible: ${linea.stockActual}`);
      return;
    }
    this.error.set(null);
    this.actualizarLinea(linea.productoId, { cantidadEntregada: linea.cantidadEntregada + 1 });
  }

  restar(linea: LineaEntrega) {
    if (linea.cantidadEntregada === 0) return;
    this.actualizarLinea(linea.productoId, { cantidadEntregada: linea.cantidadEntregada - 1 });
  }

  sumarEnvase(linea: LineaEntrega) {
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: linea.cantidadEnvaseDevuelto + 1 });
  }

  restarEnvase(linea: LineaEntrega) {
    if (linea.cantidadEnvaseDevuelto === 0) return;
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: linea.cantidadEnvaseDevuelto - 1 });
  }

  actualizarPrecio(linea: LineaEntrega, valor: number) {
    this.actualizarLinea(linea.productoId, { precioUnitario: Math.max(0, valor) });
  }

  actualizarEnvases(linea: LineaEntrega, valor: number) {
    const max = this.maxEnvasesDevolvibles(linea);
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: Math.max(0, Math.min(max, valor)) });
  }

  private actualizarLinea(productoId: string, cambios: Partial<LineaEntrega>) {
    this.lineas.update((lineas) =>
      lineas.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l))
    );
  }

  confirmar() {
    this.verificarStock(() => this.registrarEntrega());
  }

  private hayMovimientos(): boolean {
    const hayMovimientos = this.lineas().some(
      (linea) => linea.cantidadEntregada > 0 || linea.cantidadEnvaseDevuelto > 0
    );

    if (!hayMovimientos) {
      this.error.set('Agregá al menos un producto entregado o un envase devuelto');
    }

    return hayMovimientos;
  }

  private verificarStock(continuar: () => void) {
    if (this.verificandoStock() || this.guardando()) return;

    this.verificandoStock.set(true);
    this.error.set(null);

    this.productoService.listar().subscribe({
      next: (productos) => {
        const stockPorProducto = new Map(
          productos.map((producto) => [producto.id, Number(producto.stockActual)])
        );

        this.lineas.update((lineas) =>
          lineas.map((linea) => ({
            ...linea,
            stockActual: stockPorProducto.get(linea.productoId) ?? 0,
          }))
        );

        const faltantes = this.lineas().filter(
          (linea) => linea.cantidadEntregada > linea.stockActual
        );

        this.verificandoStock.set(false);

        if (faltantes.length > 0) {
          const detalle = faltantes
            .map(
              (linea) =>
                `${linea.nombre} (solicitado: ${linea.cantidadEntregada}, disponible: ${linea.stockActual})`
            )
            .join(', ');
          this.error.set(`Stock insuficiente: ${detalle}`);
          return;
        }

        continuar();
      },
      error: () => {
        this.verificandoStock.set(false);
        this.error.set('No se pudo verificar el stock. Intentá nuevamente.');
      },
    });
  }

  private registrarEntrega() {
    const cliente = this.cliente();
    if (!cliente) return;

    const detalles = this.lineas()
      .filter((l) => l.cantidadEntregada > 0 || l.cantidadEnvaseDevuelto > 0)
      .map((l) => ({
        productoId: l.productoId,
        cantidadEntregada: l.cantidadEntregada,
        cantidadEnvaseDevuelto: l.cantidadEnvaseDevuelto,
        precioUnitario: l.precioUnitario,
      }));


    const resumen = this.armarResumen(cliente.nombre, cliente.apellido);
    if (!confirm(resumen)) return;

    this.guardando.set(true);
    this.error.set(null);

    this.historialService
      .crearEntrega({
        clienteId: cliente.id,
        montoPagado: this.montoPagado(),
        observacion: this.observacion || undefined,
        metodoPago: this.metodoPago(),
        pedidoId: this.pedidoId ?? undefined,
        detalles,
      })
      .subscribe({
        next: () => {
          this.router.navigate(['/clientes', cliente.id]);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo registrar la entrega');
        },
      });
  }

  private armarResumen(nombre: string, apellido: string): string {
    const lineasConMovimiento = this.lineas().filter(
      (l) => l.cantidadEntregada > 0 || l.cantidadEnvaseDevuelto > 0
    );

    const detalleTexto = lineasConMovimiento.length > 0
      ? lineasConMovimiento
        .map((l) => `• ${l.nombre}: ${l.cantidadEntregada} entregados, ${l.cantidadEnvaseDevuelto} envases devueltos`)
        .join('\n')
      : '(Entrega informal, sin productos cargados)';

    return (
      `Confirmar entrega a ${nombre} ${apellido}\n\n` +
      `${detalleTexto}\n\n` +
      `Total: $${this.importeTotal()}\n` +
      `Pagó: $${this.montoPagado()} (${this.metodoPago() === 'efectivo' ? 'Efectivo' : this.metodoPago() === 'transferencia' ? 'Transferencia' : 'QR'})\n` +
      `Saldo final: $${this.saldoFinal()}\n\n` +
      `¿Confirmás el registro?`
    );
  }

  superaEsperado(linea: LineaEntrega): boolean {
    const max = linea.envasesPreviosCliente + linea.cantidadEntregada;
    return linea.cantidadEnvaseDevuelto > max;
  }
}
