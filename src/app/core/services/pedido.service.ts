import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environments";
import { Observable } from "rxjs";
import { Pedido } from "../models/pedido.model";

@Injectable({
    providedIn: 'root'
})
export class PedidoService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/pedidos`

    listarPendientes(): Observable<Pedido[]> {
        return this.http.get<Pedido[]>(this.baseUrl)
    }

    crear(clienteId: string, detalle: string): Observable<Pedido> {
        return this.http.post<Pedido>(this.baseUrl, { clienteId, detalle })
    }

    marcarEntregado(id: string): Observable<Pedido> {
        return this.http.put<Pedido>(`${this.baseUrl}/${id}/entregar`, {})
    }

    eliminar(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`)
    }
}