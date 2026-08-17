import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { MetodoPago } from '../../core/models/historial.model';

@Component({
  selector: 'app-pago-modal',
  imports: [FormsModule],
  templateUrl: './pago-modal.html',
  styleUrl: './pago-modal.css',
})
export default class PagoModal {
  private historialService = inject(HistorialService);

  clienteId = input.required<string>();
  nombreCliente = input.required<string>();
  saldoActual = input.required<number>();

  cerrar = output<void>();
  pagoRegistrado = output<void>();

  monto = 0;
  metodoPago = signal<MetodoPago>('efectivo');
  observacion = '';
  guardando = signal(false);
  error = signal<string | null>(null);

  confirmar() {
    if (this.monto <= 0) {
      this.error.set('El monto tiene que ser mayor a 0');
      return;
    }

    const resumen =
      `Registrar pago de ${this.nombreCliente()}\n\n` +
      `Monto: $${this.monto}\n` +
      `Método: ${this.metodoPago() === 'efectivo' ? 'Efectivo' : 'Transferencia'}\n` +
      `Saldo antes: $${this.saldoActual()}\n` +
      `Saldo después: $${this.saldoActual() - this.monto}\n\n` +
      `¿Confirmás el registro?`;

    if (!confirm(resumen)) return;

    this.guardando.set(true);
    this.error.set(null);

    this.historialService
      .crearEntrega({
        clienteId: this.clienteId(),
        montoPagado: this.monto,
        observacion: this.observacion || 'Pago sin entrega',
        metodoPago: this.metodoPago(),
        detalles: [],
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.pagoRegistrado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo registrar el pago');
        },
      });
  }
}
