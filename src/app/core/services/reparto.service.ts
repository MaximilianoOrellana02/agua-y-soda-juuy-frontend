import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environments';
import { CamionetaService } from './camioneta.service';
import { Reparto, ResumenReparto } from '../models/reparto.model';

// Reparto del día del usuario (lo guarda el backend: vale en cualquier dispositivo) y las ventanas asociadas.
@Injectable({ providedIn: 'root' })
export class RepartoService {
    private http = inject(HttpClient);
    private camionetaService = inject(CamionetaService);
    private baseUrl = `${environment.apiUrl}/repartos/hoy`;

    // undefined = todavía no se consultó; null = hoy no empezó.
    repartoHoy = signal<Reparto | null | undefined>(undefined);
    resumen = signal<ResumenReparto | null>(null);

    // Ventana de elegir/cargar camioneta. null = cerrada; 'inicio' = desde "Comenzar reparto" (con saludo);
    // 'cambio' = elegir otra camioneta; 'cargar' = directo al paso de carga de la camioneta del día.
    selector = signal<'inicio' | 'cambio' | 'cargar' | null>(null);
    // Panel con el stock actual de la camioneta del día.
    verStock = signal(false);
    verResumen = signal(false);

    comenzadoHoy = computed<boolean | undefined>(() => {
        const reparto = this.repartoHoy();
        return reparto === undefined ? undefined : reparto !== null;
    });
    terminadoHoy = computed(() => !!this.repartoHoy()?.finalizadoEn);

    cargarRepartoHoy(): Observable<Reparto | null> {
        return this.http.get<{ reparto: Reparto | null; resumen: ResumenReparto | null }>(this.baseUrl).pipe(
            tap(({ reparto, resumen }) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(resumen);
            }),
            map(({ reparto }) => reparto),
        );
    }

    // Se llama al elegir camioneta o "Hoy no uso camioneta". El backend toma la camioneta elegida; repetirlo no duplica.
    registrarComienzo(): Observable<Reparto> {
        return this.http.post<Reparto>(`${this.baseUrl}/comenzar`, {}).pipe(tap((reparto) => this.repartoHoy.set(reparto)));
    }

    terminar(): Observable<ResumenReparto> {
        return this.http.post<{ reparto: Reparto; resumen: ResumenReparto }>(`${this.baseUrl}/terminar`, {}).pipe(
            tap(({ reparto, resumen }) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(resumen);
            }),
            map(({ resumen }) => resumen),
        );
    }

    // "Cancelar fin de reparto": vuelve a quedar en curso (solo el de hoy).
    reabrir(): Observable<Reparto> {
        return this.http.post<Reparto>(`${this.baseUrl}/reabrir`, {}).pipe(
            tap((reparto) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(null);
            }),
        );
    }

    comenzar() {
        this.selector.set('inicio');
    }

    cambiarCamioneta() {
        this.verStock.set(false);
        this.selector.set('cambio');
    }

    cargarCamioneta() {
        this.verStock.set(false);
        this.selector.set('cargar');
    }

    cerrarSelector() {
        this.selector.set(null);
        // Lo que se haya elegido o cargado cambia el stock que muestran Hoy y el panel.
        this.camionetaService.refrescarStockDelDia().subscribe({ error: () => {} });
    }

    // Indicador de la barra superior: con camioneta muestra su stock; sin camioneta, ofrece elegir una.
    abrirDesdeIndicador() {
        if (this.camionetaService.camionetaDelDia()) this.verStock.set(true);
        else this.cambiarCamioneta();
    }

    cerrarStock() {
        this.verStock.set(false);
    }

    abrirResumen() {
        this.verResumen.set(true);
    }

    cerrarResumen() {
        this.verResumen.set(false);
    }
}
