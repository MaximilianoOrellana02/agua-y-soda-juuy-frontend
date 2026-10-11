import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CamionetaService } from '../../core/services/camioneta.service';
import { RepartoService } from '../../core/services/reparto.service';

// Stock actual de la camioneta del día, en una ventana flotante. Se abre desde el indicador de la barra superior o desde Hoy.
@Component({
  selector: 'app-camioneta-stock-sheet',
  imports: [RouterLink],
  templateUrl: './camioneta-stock-sheet.html',
  styleUrl: './camioneta-stock-sheet.css',
})
export default class CamionetaStockSheet implements OnInit {
  camionetaService = inject(CamionetaService);
  repartoService = inject(RepartoService);
  cerrar = output<void>();

  cargando = signal(true);
  error = signal<string | null>(null);

  // Solo lo que lleva; los productos en 0 no aportan nada en la calle.
  conStock = computed(() =>
    (this.camionetaService.stockDelDia() ?? [])
      .filter((s) => s.cantidad > 0)
      .sort((a, b) => (a.producto?.nombre ?? '').localeCompare(b.producto?.nombre ?? '')),
  );
  total = computed(() => this.conStock().reduce((acc, s) => acc + s.cantidad, 0));

  ngOnInit() {
    // Siempre se consulta al abrir: las entregas lo van descontando durante el día.
    this.camionetaService.refrescarStockDelDia().subscribe({
      next: () => this.cargando.set(false),
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el stock de la camioneta');
      },
    });
  }
}
