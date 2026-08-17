import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductoService } from '../../../core/services/producto.service';
import { precioVigente, Producto } from '../../../core/models/producto.model';

@Component({
  selector: 'app-productos-list',
  imports: [RouterLink],
  templateUrl: './productos-list.html',
  styleUrl: './productos-list.css',
})
export default class ProductosList implements OnInit {
  private productoService = inject(ProductoService);

  productos = signal<Producto[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarProductos()
  }

  cargarProductos() {
    this.cargando.set(true);
    this.productoService.listar().subscribe({
      next: (data) => {
        this.productos.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos');
        this.cargando.set(false);
      },
    });
  }

  precioParticular(p: Producto): number | null {
    return precioVigente(p, 'particular');
  }

  precioConfianza(p: Producto): number | null {
    return precioVigente(p, 'confianza');
  }

  get productosStockBajo(): Producto[] {
    return this.productos().filter((p) => p.activo && p.stockMinimo > 0 && p.stockActual <= p.stockMinimo);
  }
}
