export type MetodoPago = 'efectivo' | 'transferencia' | 'mercadopago';


export interface HistorialDetalleInput {
    productoId: string;
    cantidadEntregada: number;
    cantidadEnvaseDevuelto: number;
    precioUnitario: number;
}

export interface HistorialInput {
    clienteId: string;
    montoPagado: number;
    observacion?: string;
    metodoPago?: MetodoPago;
    pedidoId?: string;
    detalles: HistorialDetalleInput[];
}

export interface Historial {
    id: string;
    clienteId: string;
    usuarioId: string;
    fecha: string;
    saldoAnterior: number;
    importeTotal: number;
    montoPagado: number;
    saldoFinal: number;
    observacion: string | null;
    cliente?: { id: string; nombre: string; apellido: string };
    usuario?: { id: string; nombreCompleto: string };
    detalles?: HistorialDetalle[];
    metodoPago: MetodoPago;
}

export interface HistorialPage {
    data: Historial[];
    total: number;
    page: number;
    totalPages: number;
}


export interface HistorialDetalle {
    id: string;
    productoId: string;
    cantidadEntregada: number;
    cantidadEnvaseDevuelto: number;
    precioUnitario: number;
    importe: number;
    producto?: { id: string; nombre: string };
}

export function cantidadPorCategoria(historial: Historial, palabra: string): number {
    return (historial.detalles ?? [])
        .filter((d) => d.producto?.nombre?.toLowerCase().includes(palabra))
        .reduce((acc, d) => acc + d.cantidadEntregada, 0);
}

export interface ResumenHistorial {
    cantidadEntregas: number;
    totalImporte: number;
    totalPagado: number;
    totalPendiente: number;
    productos: { nombre: string; cantidad: number }[];
}

export interface ResumenHoy {
    cobrado: number;
    entregasCount: number;
    entregados: number;
    devueltos: number;
}