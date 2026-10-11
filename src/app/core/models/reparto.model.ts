export interface Reparto {
    id: string;
    usuarioId: string;
    camionetaId: string | null;
    camioneta: { id: string; nombre: string; patente: string | null } | null;
    fecha: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
}

export interface ResumenReparto {
    fecha: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
    camioneta: { id: string; nombre: string; patente: string | null } | null;
    entregas: number;
    totalVendido: number;
    cobrado: number;
    cobradoPorMetodo: { efectivo: number; transferencia: number; mercadopago: number };
    fiado: number;
    productos: { nombre: string; cantidad: number; devueltos: number }[];
    // null si salió sin camioneta.
    stockCamioneta: { nombre: string; cargado: number; queda: number }[] | null;
}
