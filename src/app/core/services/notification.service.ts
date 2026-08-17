import { Injectable, signal } from "@angular/core";

export interface Notificacion {
    mensaje: string;
    tipo: 'error' | 'info';
}

@Injectable({ providedIn: 'root' })

export class NotificationService {
    notificacion = signal<Notificacion | null>(null);
    private timeoutId?: ReturnType<typeof setTimeout>;

    mostrar(mensaje: string, tipo: Notificacion['tipo'] = 'error') {
        clearTimeout(this.timeoutId);
        this.notificacion.set({ mensaje, tipo });
        this.timeoutId = setTimeout(() => this.notificacion.set(null), 4000);
    }

    cerrar() {
        clearTimeout(this.timeoutId);
        this.notificacion.set(null);
    }
}