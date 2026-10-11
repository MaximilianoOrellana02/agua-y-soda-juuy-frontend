import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { CamionetaService } from '../../core/services/camioneta.service';
import { ProductoService } from '../../core/services/producto.service';
import { NotificationService } from '../../core/services/notification.service';
import { RepartoService } from '../../core/services/reparto.service';
import { Camioneta } from '../../core/models/camioneta.model';

interface LineaCarga {
  productoId: string;
  nombre: string;
  enCamioneta: number;
  enDeposito: number;
  cantidad: number;
}

// Inicio del reparto en dos pasos: 1) con qué camioneta sale, 2) qué se carga en ella.
// Se abre con "Comenzar reparto" (en Hoy) y al tocar el indicador de la barra superior.
@Component({
  selector: 'app-camioneta-dia-modal',
  templateUrl: './camioneta-dia-modal.html',
  styleUrl: './camioneta-dia-modal.css',
})
export default class CamionetaDiaModal implements OnInit {
  camionetaService = inject(CamionetaService);
  private productoService = inject(ProductoService);
  private notificationService = inject(NotificationService);
  private repartoService = inject(RepartoService);

  // true cuando se abre desde "Comenzar reparto" (muestra el saludo).
  inicioDelDia = input(false);
  // true para abrir directo en la carga de la camioneta del día (desde el panel de stock).
  soloCargar = input(false);
  cerrar = output<void>();

  paso = signal<'elegir' | 'cargar'>('elegir');
  camionetas = signal<Camioneta[]>([]);
  cargando = signal(true);
  guardando = signal<string | null>(null);
  error = signal<string | null>(null);

  // Paso 2
  camionetaACargar = signal<Camioneta | null>(null);
  lineas = signal<LineaCarga[]>([]);
  cargandoStock = signal(false);
  descontarDeposito = signal(true);

  totalACargar = computed(() => this.lineas().reduce((acc, l) => acc + l.cantidad, 0));
  yaTiene = computed(() => this.lineas().filter((l) => l.enCamioneta > 0));
  faltantes = computed(() =>
    this.descontarDeposito() ? this.lineas().filter((l) => l.cantidad > l.enDeposito) : [],
  );

  ngOnInit() {
    const actual = this.camionetaService.camionetaDelDia();
    if (this.soloCargar() && actual) this.irACargar(actual);
    this.camionetaService.listar().subscribe({
      next: (camionetas) => {
        this.camionetas.set(camionetas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las camionetas');
        this.cargando.set(false);
      },
    });
  }

  esActual(camioneta: Camioneta): boolean {
    return this.camionetaService.camionetaDelDia()?.id === camioneta.id;
  }

  // ---------- Paso 1: elegir ----------

  // Elegir camioneta (o salir sin ella) es lo que comienza el reparto del día. Si ya empezó, el backend
  // actualiza la camioneta del reparto al elegir, así que no hace falta volver a registrarlo.
  private comenzarSiFalta(): Observable<unknown> {
    return this.repartoService.comenzadoHoy() ? of(null) : this.repartoService.registrarComienzo();
  }

  elegir(camioneta: Camioneta) {
    if (this.guardando()) return;
    this.guardando.set(camioneta.id);
    this.error.set(null);
    const eleccion = this.esActual(camioneta) ? of(camioneta) : this.camionetaService.elegir(camioneta.id);
    eleccion.pipe(switchMap(() => this.comenzarSiFalta())).subscribe({
      next: () => {
        this.guardando.set(null);
        this.irACargar(camioneta);
      },
      error: (err) => {
        this.guardando.set(null);
        this.error.set(err.error?.error ?? 'No se pudo elegir la camioneta');
      },
    });
  }

  sinCamioneta() {
    if (this.guardando()) return;
    this.guardando.set('deposito');
    // Si no tenía ninguna elegida no hay nada que dejar en el servidor; igual cuenta como reparto comenzado.
    const dejar = this.camionetaService.camionetaDelDia() ? this.camionetaService.dejar() : of(null);
    dejar.pipe(switchMap(() => this.comenzarSiFalta())).subscribe({
      next: () => {
        this.notificationService.mostrar('Hoy no usás camioneta: las entregas salen del depósito.', 'success');
        this.cerrar.emit();
      },
      error: (err) => {
        this.guardando.set(null);
        this.error.set(err.error?.error ?? 'No se pudo cambiar la camioneta');
      },
    });
  }

  // ---------- Paso 2: cargar ----------

  private irACargar(camioneta: Camioneta) {
    this.camionetaACargar.set(camioneta);
    this.paso.set('cargar');
    this.descontarDeposito.set(true);
    this.error.set(null);
    this.cargandoStock.set(true);
    forkJoin({
      productos: this.productoService.listar(),
      datos: this.camionetaService.stock(camioneta.id),
    }).subscribe({
      next: ({ productos, datos }) => {
        const enCamioneta = new Map(datos.stock.map((s) => [s.productoId, s.cantidad]));
        this.lineas.set(
          productos
            .filter((p) => p.activo)
            .map((p) => ({
              productoId: p.id,
              nombre: p.nombre,
              enCamioneta: enCamioneta.get(p.id) ?? 0,
              enDeposito: Number(p.stockActual),
              cantidad: 0,
            })),
        );
        this.cargandoStock.set(false);
      },
      error: () => {
        this.cargandoStock.set(false);
        this.error.set('No se pudo cargar el stock');
      },
    });
  }

  volverAElegir() {
    this.paso.set('elegir');
    this.error.set(null);
  }

  cambiarCantidad(linea: LineaCarga, valor: number | string | null) {
    const numero = Math.max(0, Math.floor(Number(valor) || 0));
    this.lineas.update((lineas) =>
      lineas.map((l) => (l.productoId === linea.productoId ? { ...l, cantidad: numero } : l)),
    );
  }

  sumar(linea: LineaCarga, delta: number) {
    this.cambiarCantidad(linea, linea.cantidad + delta);
  }

  confirmarCarga() {
    const camioneta = this.camionetaACargar();
    if (!camioneta || this.guardando()) return;
    const items = this.lineas()
      .filter((l) => l.cantidad > 0)
      .map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }));
    if (items.length === 0) {
      this.error.set('Indicá cuánto cargás de al menos un producto, o tocá "Ahora no".');
      return;
    }
    if (this.faltantes().length > 0) {
      const detalle = this.faltantes().map((l) => `${l.nombre} (hay ${l.enDeposito})`).join(', ');
      this.error.set(`No alcanza el stock del depósito: ${detalle}`);
      return;
    }

    this.guardando.set('carga');
    this.error.set(null);
    this.camionetaService.cargar(camioneta.id, items, this.descontarDeposito()).subscribe({
      next: () => {
        const total = this.totalACargar();
        this.notificationService.mostrar(
          `Cargaste ${total} u. en ${camioneta.nombre}` +
            (this.descontarDeposito() ? ', descontadas del depósito.' : ', sin tocar el depósito.'),
          'success',
        );
        this.cerrar.emit();
      },
      error: (err) => {
        this.guardando.set(null);
        this.error.set(err.error?.error ?? 'No se pudo cargar la camioneta');
      },
    });
  }
}
