import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { PrecioProducto } from '../../core/models/producto.model';

@Component({
  selector: 'app-precio-historial-modal',
  imports: [DatePipe],
  templateUrl: './precio-historial-modal.html',
  styleUrl: './precio-historial-modal.css',
})
export class PrecioHistorialModal {
  nombreProducto = input.required<string>();
  precios = input.required<PrecioProducto[]>();

  cerrar = output<void>();

  get ordenados(): PrecioProducto[] {
    return [...this.precios()].sort(
      (a, b) => new Date(b.fechaDesde).getTime() - new Date(a.fechaDesde).getTime()
    );
  }
}
