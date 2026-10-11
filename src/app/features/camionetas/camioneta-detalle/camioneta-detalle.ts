import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CamionetaService } from '../../../core/services/camioneta.service';
import { ProductoService } from '../../../core/services/producto.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Camioneta, StockCamioneta, TipoMovimientoCamioneta } from '../../../core/models/camioneta.model';
import { Producto } from '../../../core/models/producto.model';

@Component({
  selector: 'app-camioneta-detalle',
  imports: [FormsModule, RouterLink],
  templateUrl: './camioneta-detalle.html',
  styleUrl: '../camionetas.css',
})
export default class CamionetaDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  authService = inject(AuthService);
  private camionetaService = inject(CamionetaService);
  private productoService = inject(ProductoService);
  private notificationService = inject(NotificationService);

  camioneta = signal<Camioneta | null>(null);
  stock = signal<StockCamioneta[]>([]);
  productos = signal<Producto[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  // Formulario de carga / descarga
  mostrarMovimiento = signal(false);
  tipo = signal<TipoMovimientoCamioneta>('carga');
  productoId = signal('');
  cantidad = 0;
  motivo = '';
  // false: la carga no sale del depósito / la descarga no vuelve (merma).
  afectaStockGeneral = signal(true);
  guardando = signal(false);
  errorMovimiento = signal<string | null>(null);

  productosActivos = computed(() => this.productos().filter((p) => p.activo));
  stockConProductos = computed(() => this.stock().filter((s) => s.cantidad > 0 || s.producto?.activo));
  totalUnidades = computed(() => this.stock().reduce((acc, s) => acc + s.cantidad, 0));

  // Lo disponible en el origen del movimiento, para avisar antes de enviar.
  disponible = computed(() => {
    const id = this.productoId();
    if (!id) return null;
    if (this.tipo() === 'carga') {
      if (!this.afectaStockGeneral()) return null; // mercadería que no sale del depósito: no hay tope
      return this.productos().find((p) => p.id === id)?.stockActual ?? 0;
    }
    return this.stock().find((s) => s.productoId === id)?.cantidad ?? 0;
  });

  // Una descarga que no vuelve al depósito es una pérdida (rotura, merma): el backend exige motivo.
  motivoObligatorio = computed(() => this.tipo() === 'descarga' && !this.afectaStockGeneral());

  ngOnInit() {
    this.cargar();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      datos: this.camionetaService.stock(this.id),
      productos: this.productoService.listar(),
    }).subscribe({
      next: ({ datos, productos }) => {
        this.camioneta.set(datos.camioneta);
        this.stock.set(datos.stock);
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.status === 404 ? 'Camioneta no encontrada' : err.error?.error ?? 'No se pudo cargar la camioneta');
        this.cargando.set(false);
      },
    });
  }

  abrirMovimiento(tipo: TipoMovimientoCamioneta) {
    this.tipo.set(tipo);
    const opciones = tipo === 'carga' ? this.productosActivos().map((p) => p.id) : this.stock().filter((s) => s.cantidad > 0).map((s) => s.productoId);
    this.productoId.set(opciones[0] ?? '');
    this.cantidad = 0;
    this.motivo = '';
    this.afectaStockGeneral.set(true);
    this.errorMovimiento.set(null);
    this.mostrarMovimiento.set(true);
  }

  cerrarMovimiento() {
    this.mostrarMovimiento.set(false);
  }

  confirmarMovimiento() {
    const camioneta = this.camioneta();
    if (!camioneta) return;
    const cantidad = Number(this.cantidad);
    if (!this.productoId()) {
      this.errorMovimiento.set('Elegí un producto');
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      this.errorMovimiento.set('La cantidad tiene que ser un número entero mayor a 0');
      return;
    }
    const disponible = this.disponible();
    if (disponible !== null && cantidad > disponible) {
      this.errorMovimiento.set(`No alcanza: hay ${disponible} disponibles`);
      return;
    }
    if (this.motivoObligatorio() && !this.motivo.trim()) {
      this.errorMovimiento.set('Indicá el motivo (por ejemplo, rotura)');
      return;
    }

    this.guardando.set(true);
    this.errorMovimiento.set(null);
    this.camionetaService
      .mover(camioneta.id, {
        productoId: this.productoId(),
        tipo: this.tipo(),
        cantidad,
        motivo: this.motivo.trim() || undefined,
        afectaStockGeneral: this.afectaStockGeneral(),
      })
      .subscribe({
        next: () => {
          const producto = this.productos().find((p) => p.id === this.productoId())?.nombre ?? 'producto';
          this.guardando.set(false);
          this.mostrarMovimiento.set(false);
          this.notificationService.mostrar(
            `${this.tipo() === 'carga' ? 'Carga' : 'Descarga'} de ${cantidad} ${producto} registrada.`,
            'success',
          );
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorMovimiento.set(err.error?.error ?? 'No se pudo registrar el movimiento');
        },
      });
  }

  nombreProducto(id: string): string {
    return this.productos().find((p) => p.id === id)?.nombre ?? '';
  }
}
