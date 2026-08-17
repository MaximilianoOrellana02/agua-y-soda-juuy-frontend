import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environments';
import { map, Observable } from 'rxjs';
import { Cliente, ClienteDeudaVieja, ClienteInput } from '../models/cliente.model';

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/clientes`;

  private normalizarCliente(c: Cliente): Cliente {
    return {
      ...c,
      saldoActual: Number(c.saldoActual),
      latitud: c.latitud != null ? Number(c.latitud) : null,
      longitud: c.longitud != null ? Number(c.longitud) : null,
    };
  }

  listar(): Observable<Cliente[]> {
    return this.http
      .get<Cliente[]>(this.baseUrl)
      .pipe(map((clientes) => clientes.map((c) => this.normalizarCliente(c))));
  }

  obtenerCliente(id: string): Observable<Cliente> {
    return this.http
      .get<Cliente>(`${this.baseUrl}/${id}`)
      .pipe(map((c) => this.normalizarCliente(c)));
  }

  crear(cliente: ClienteInput): Observable<Cliente> {
    return this.http.post<Cliente>(this.baseUrl, cliente);
  }

  actualizar(id: string, cliente: Partial<ClienteInput>): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.baseUrl}/${id}`, cliente);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  obtenerSaldoEnvases(id: string): Observable<{ productoId: string; cantidad: number }[]> {
    return this.http.get<{ productoId: string; cantidad: number }[]>(
      `${this.baseUrl}/${id}/envases`,
    );
  }
  ajustarUbicacion(id: string, latitud: number, longitud: number): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.baseUrl}/${id}/ubicacion`, { latitud, longitud });
  }

  marcarVisita(id: string, visitado: boolean): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.baseUrl}/${id}/visita`, { visitado });
  }

  listarDeudaVieja(dias: number = 30): Observable<ClienteDeudaVieja[]> {
    return this.http.get<ClienteDeudaVieja[]>(`${this.baseUrl}/deuda-vieja`, {
      params: { dias },
    });
  }
}
