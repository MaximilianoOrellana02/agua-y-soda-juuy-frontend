import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistorialService } from '../../../core/services/historial.service';
import { Historial } from '../../../core/models/historial.model';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import DashboardModal from '../../../shared/dashboard-modal/dashboard-modal';


type Filtro = 'hoy' | 'semana' | 'mes' | 'todos';


@Component({
  selector: 'app-historial-list',
  imports: [RouterLink, DatePipe, DashboardModal],
  templateUrl: './historial-list.html',
  styleUrl: './historial-list.css',
})
export default class HistorialList implements OnInit {
  private historialService = inject(HistorialService);


  entregas = signal<Historial[]>([]);
  filtro = signal<Filtro>('hoy');
  page = signal(1);
  totalPages = signal(1);

  cargando = signal(true);
  cargandoMas = signal(false);
  error = signal<string | null>(null);

  mostrarDashboard = signal(false);

  abrirDashboard() {
    this.mostrarDashboard.set(true);
  }

  cerrarDashboard() {
    this.mostrarDashboard.set(false);
  }

  etiquetaFiltroActual(): string {
    const mapa: Record<string, string> = { hoy: 'Hoy', semana: 'Últimos 7 días', mes: 'Este mes', todos: 'Todos' };
    return mapa[this.filtro()] ?? 'Todos';
  }

  ngOnInit(): void {
    this.cargar(true)
  }

  cambiarFiltro(filtro: Filtro) {
    if (this.filtro() === filtro) return;
    this.filtro.set(filtro);
    this.cargar(true)
  }

  rangoFechas(): { desde?: string; hasta?: string } {
    const hoy = new Date();
    const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    switch (this.filtro()) {
      case 'hoy':
        return { desde: inicioDelDia.toISOString() };
      case 'semana': {
        const hace7dias = new Date(inicioDelDia);
        hace7dias.setDate(hace7dias.getDate() - 6);
        return { desde: hace7dias.toISOString() };
      }
      case 'mes': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return { desde: inicioMes.toISOString() };
      }
      case 'todos':
        return {};
    }
  }

  cargar(reset: boolean) {
    if (reset) {
      this.cargando.set(true);
      this.page.set(1);
    } else {
      this.cargandoMas.set(true);
    }
    this.error.set(null);

    this.historialService.listar({ page: this.page(), ...this.rangoFechas() }).subscribe({
      next: (resultado) => {
        this.entregas.set(reset ? resultado.data : [...this.entregas(), ...resultado.data]);
        this.totalPages.set(resultado.totalPages);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial');
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  verMas() {
    this.page.update((p) => p + 1);
    this.cargar(false);
  }

  hayMasPaginas(): boolean {
    return this.page() < this.totalPages();
  }



  exportando = signal(false);

  exportarExcel() {
    this.exportando.set(true);

    this.historialService.listar({ page: 1, limit: 5000, ...this.rangoFechas() }).subscribe({
      next: (resultado) => {
        const filas = resultado.data.map((h) => ({
          Fecha: new Date(h.fecha).toLocaleDateString('es-AR'),
          Hora: new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          Cliente: `${h.cliente?.apellido ?? ''}, ${h.cliente?.nombre ?? ''}`,
          Repartidor: h.usuario?.nombreCompleto ?? '',
          'Saldo anterior': h.saldoAnterior,
          'Total entrega': h.importeTotal,
          'Monto pagado': h.montoPagado,
          'Saldo final': h.saldoFinal,
          Observación: h.observacion ?? '',
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);

        hoja['!cols'] = [
          { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 18 },
          { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
        ];

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

        const nombreArchivo = `historial-${this.etiquetaFiltroArchivo()}-${this.fechaHoyArchivo()}.xlsx`;
        XLSX.writeFile(libro, nombreArchivo);

        this.exportando.set(false);
      },
      error: () => {
        this.error.set('No se pudo exportar el historial');
        this.exportando.set(false);
      },
    });
  }

  private etiquetaFiltroArchivo(): string {
    const mapa: Record<string, string> = {
      hoy: 'hoy',
      semana: '7dias',
      mes: 'mes',
      todos: 'todos',
    };
    return mapa[this.filtro()] ?? 'todos';
  }

  private fechaHoyArchivo(): string {
    return new Date().toISOString().split('T')[0]; // formato AAAA-MM-DD
  }
}
