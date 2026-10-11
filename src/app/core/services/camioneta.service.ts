import { inject, Injectable, signal } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { map, Observable, of, tap } from "rxjs";
import { environment } from "../../../environments/environments";
import {
    Camioneta,
    CamionetaInput,
    CargaCamionetaResultado,
    MovimientoCamionetaInput,
    MovimientoCamionetaResultado,
    StockCamioneta,
} from "../models/camioneta.model";

@Injectable({
    providedIn: 'root'
})

export class CamionetaService {
    private baseUrl = `${environment.apiUrl}/camionetas`;
    private http = inject(HttpClient);

    // Camioneta elegida hoy por el usuario. undefined = todavía no se consultó.
    camionetaDelDia = signal<Camioneta | null | undefined>(undefined);
    // Stock actual de la camioneta del día (null = sin camioneta o todavía sin consultar).
    stockDelDia = signal<StockCamioneta[] | null>(null);

    refrescarStockDelDia(): Observable<StockCamioneta[] | null> {
        const camioneta = this.camionetaDelDia();
        if (!camioneta) {
            this.stockDelDia.set(null);
            return of(null);
        }
        return this.stock(camioneta.id).pipe(
            map(({ stock }) => stock),
            tap((stock) => this.stockDelDia.set(stock)),
        );
    }

    listar(incluirInactivas = false): Observable<Camioneta[]> {
        const params = incluirInactivas ? new HttpParams().set('incluirInactivas', 'true') : undefined;
        return this.http.get<Camioneta[]>(this.baseUrl, { params });
    }

    crear(camioneta: CamionetaInput): Observable<Camioneta> {
        return this.http.post<Camioneta>(this.baseUrl, camioneta);
    }

    actualizar(id: string, cambios: CamionetaInput): Observable<Camioneta> {
        return this.http.put<Camioneta>(`${this.baseUrl}/${id}`, cambios);
    }

    stock(id: string): Observable<{ camioneta: Camioneta; stock: StockCamioneta[] }> {
        return this.http.get<{ camioneta: Camioneta; stock: StockCamioneta[] }>(`${this.baseUrl}/${id}/stock`);
    }

    mover(id: string, movimiento: MovimientoCamionetaInput): Observable<MovimientoCamionetaResultado> {
        return this.http.post<MovimientoCamionetaResultado>(`${this.baseUrl}/${id}/movimientos`, movimiento);
    }

    // Carga varios productos de una vez (al empezar el reparto): se aplican todos o ninguno.
    cargar(id: string, items: { productoId: string; cantidad: number }[], afectaStockGeneral: boolean): Observable<CargaCamionetaResultado> {
        return this.http.post<CargaCamionetaResultado>(`${this.baseUrl}/${id}/carga`, { items, afectaStockGeneral });
    }

    cargarCamionetaDelDia(): Observable<Camioneta | null> {
        return this.http.get<{ camioneta: Camioneta | null }>(`${this.baseUrl}/mia`).pipe(
            map((r) => r.camioneta),
            tap((camioneta) => this.camionetaDelDia.set(camioneta)),
        );
    }

    // "Hoy no uso camioneta": las entregas vuelven a salir del depósito.
    dejar(): Observable<null> {
        return this.http.delete<{ camioneta: null }>(`${this.baseUrl}/mia`).pipe(
            map(() => null),
            tap(() => this.camionetaDelDia.set(null)),
        );
    }

    elegir(id: string): Observable<Camioneta> {
        return this.http.post<{ camioneta: Camioneta }>(`${this.baseUrl}/${id}/elegir`, {}).pipe(
            map((r) => r.camioneta),
            tap((camioneta) => this.camionetaDelDia.set(camioneta)),
        );
    }
}
