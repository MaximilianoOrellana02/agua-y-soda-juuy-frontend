import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClienteService } from '../../../core/services/cliente.service';
import { CategoriaCliente, Cliente, TipoCliente } from '../../../core/models/cliente.model';
import { DecimalPipe } from '@angular/common';
import { Barrio, DIAS_SEMANA } from '../../../core/models/barrio.model';
import { BarrioService } from '../../../core/services/barrio.service';
import MapaCliente from '../../../shared/mapa-cliente/mapa-cliente';
import { armarLinkWhatsapp } from '../../../shared/whatsapp.util';
import PagoModal from '../../../shared/pago-modal/pago-modal';
import { HistorialService } from '../../../core/services/historial.service';
import { Historial } from '../../../core/models/historial.model';

export interface MovimientoItem {
  id: string;
  fechaTexto: string;
  titulo: string;
  subtitulo: string;
  monto: number;
}

@Component({
  selector: 'app-cliente-detalle',
  imports: [FormsModule, RouterLink, DecimalPipe, MapaCliente, PagoModal],
  templateUrl: './cliente-detalle.html',
  styleUrl: './cliente-detalle.css',
})
export default class ClienteDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private historialService = inject(HistorialService);

  cliente = signal<Cliente | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  editando = signal(false);
  guardando = signal(false);
  barrios = signal<Barrio[]>([]);
  movimientos = signal<MovimientoItem[]>([]);
  movimientosCargando = signal(false);

  mostrarPago = signal(false);

  abrirPago() {
    this.mostrarPago.set(true);
  }

  cerrarPago() {
    this.mostrarPago.set(false);
  }

  onPagoRegistrado() {
    const actual = this.cliente();
    if (actual) {
      this.cargarCliente(actual.id);
      this.cargarMovimientos(actual.id);
    }
    this.mostrarPago.set(false);
  }

  ajustandoUbicacion = signal(false);
  nuevaUbicacion = signal<{ latitud: number; longitud: number } | null>(null);

  mapaEdicionAbierto = signal(true);

  toggleMapaEdicion() {
    this.mapaEdicionAbierto.update((v) => !v);
  }

  onPosicionEditCambiada(pos: { latitud: number; longitud: number }) {
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

  ngOnInit() {
    this.barrioService.listar().subscribe({
      next: (data) => this.barrios.set(data),
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Cliente no especificado');
      this.cargando.set(false);
      return;
    }
    this.cargarCliente(id);
    this.cargarMovimientos(id);
  }

  cargarCliente(id: string) {
    this.cargando.set(true);
    this.clienteService.obtenerCliente(id).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.sincronizarFormulario(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el cliente');
        this.cargando.set(false);
      },
    });
  }

  cargarMovimientos(id: string) {
    this.movimientosCargando.set(true);
    this.historialService.porCliente(id).subscribe({
      next: (data: Historial[]) => {
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const items: MovimientoItem[] = data.slice(0, 5).map((h) => {
          let dia = '';
          let mes = '';
          const match = h.fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            dia = parseInt(match[3], 10).toString();
            const mesIdx = parseInt(match[2], 10) - 1;
            mes = meses[mesIdx] || '';
          } else {
            const fechaObj = new Date(h.fecha);
            dia = !isNaN(fechaObj.getTime()) ? fechaObj.getDate().toString() : '';
            mes = !isNaN(fechaObj.getTime()) ? meses[fechaObj.getMonth()] : '';
          }
          const fechaTexto = `${dia} ${mes}`.trim();

          const esEntrega = (h.detalles && h.detalles.length > 0) || Number(h.importeTotal) > 0;
          let titulo = '';
          let subtitulo = '';
          let monto = 0;

          if (esEntrega) {
            titulo = 'Entrega semanal';
            const entregados = (h.detalles ?? []).reduce((acc, d) => acc + (Number(d.cantidadEntregada) || 0), 0);
            const vacios = (h.detalles ?? []).reduce((acc, d) => acc + (Number(d.cantidadEnvaseDevuelto) || 0), 0);

            if (entregados > 0 && vacios > 0) {
              subtitulo = `+${entregados} entregados · ${vacios} vacíos`;
            } else if (entregados > 0) {
              subtitulo = `+${entregados} entregados`;
            } else if (vacios > 0) {
              subtitulo = `${vacios} vacíos`;
            } else {
              subtitulo = h.observacion || 'Sin productos';
            }
            monto = Number(h.importeTotal);
          } else {
            if (h.metodoPago === 'transferencia') {
              titulo = 'Pago con transferencia';
            } else if (h.metodoPago === 'mercadopago') {
              titulo = 'Pago con Mercado Pago';
            } else {
              titulo = 'Pago en efectivo';
            }
            subtitulo = '—';
            monto = Number(h.montoPagado);
          }

          return {
            id: h.id,
            fechaTexto,
            titulo,
            subtitulo,
            monto,
          };
        });
        this.movimientos.set(items);
        this.movimientosCargando.set(false);
      },
      error: () => {
        this.movimientosCargando.set(false);
      },
    });
  }

  private sincronizarFormulario(cliente: Cliente) {
    this.form = {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      localidad: cliente.localidad ?? '',
      barrioId: cliente.barrioId ?? '',
      categoria: cliente.categoria,
      tipoCliente: cliente.tipoCliente,
      latitud: cliente.latitud,
      longitud: cliente.longitud,
    };
  }

  activarEdicion() {
    this.editando.set(true);
  }

  cancelarEdicion() {
    const actual = this.cliente();
    if (actual) this.sincronizarFormulario(actual); // descarta cambios sin guardar
    this.editando.set(false);
    this.error.set(null);
  }

  guardar() {
    const actual = this.cliente();
    if (!actual) return;

    if (!this.form.nombre || !this.form.apellido) {
      this.error.set('Nombre y apellido son obligatorios');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const payload = {
      ...this.form,
      barrioId: this.form.barrioId || undefined,
      latitud: this.form.latitud ?? undefined,
      longitud: this.form.longitud ?? undefined,
    };

    this.clienteService.actualizar(actual.id, payload).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.sincronizarFormulario(data);
        this.editando.set(false);
        this.guardando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron guardar los cambios');
        this.guardando.set(false);
      },
    });
  }

  activarAjusteUbicacion() {
    this.ajustandoUbicacion.set(true);
    this.nuevaUbicacion.set(null);
  }
  cancelarAjusteUbicacion() {
    this.ajustandoUbicacion.set(false);
    this.nuevaUbicacion.set(null);
  }

  onPosicionCambiada(pos: { latitud: number; longitud: number }) {
    this.nuevaUbicacion.set(pos);
  }

  guardarUbicacion() {
    const actual = this.cliente();
    const pos = this.nuevaUbicacion();
    if (!actual || !pos) return;

    this.clienteService.ajustarUbicacion(actual.id, pos.latitud, pos.longitud).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.ajustandoUbicacion.set(false);
        this.nuevaUbicacion.set(null);
      },
      error: () => this.error.set('No se pudo guardar la ubicación'),
    });
  }

  abrirWhatsapp(cliente: Cliente) {
    if (!cliente.telefono) return;
    const link = armarLinkWhatsapp(cliente.telefono, '');
    window.open(link, '_blank');
  }

  enviarRecordatorioWhatsapp(cliente: Cliente) {
    const mensaje = `Hola ${cliente.nombre}, te recordamos que tenés un saldo pendiente de $${cliente.saldoActual} con nostros. ¡Gracias!`
    const link = armarLinkWhatsapp(cliente.telefono ?? '', mensaje);
    window.open(link, '_blank')
  }

  get diasRepartoTexto(): string {
    const cliente = this.cliente();
    if (!cliente?.barrio) return "";

    const barrio = this.barrios().find((b) => b.id === cliente.barrioId);

    if (!barrio || barrio.diasVisita.length === 0) return '';

    const etiquetas = barrio.diasVisita.map((dia) => {
      const encontrado = DIAS_SEMANA.find((d) => d.valor === dia);
      return encontrado?.etiqueta ?? dia;
    })
    return `Reparto ${etiquetas.join(' y ')}`;

  }
}
