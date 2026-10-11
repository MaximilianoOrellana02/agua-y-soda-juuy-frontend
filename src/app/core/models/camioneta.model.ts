export interface Camioneta {
    id: string;
    nombre: string;
    patente: string | null;
    activa: boolean;
}

export interface CamionetaInput {
    nombre?: string;
    patente?: string | null;
    activa?: boolean;
}

export interface StockCamioneta {
    id: string;
    camionetaId: string;
    productoId: string;
    cantidad: number;
    producto?: { id: string; nombre: string; esRetornable: boolean; activo: boolean };
}

export type TipoMovimientoCamioneta = 'carga' | 'descarga';

export interface MovimientoCamionetaInput {
    productoId: string;
    tipo: TipoMovimientoCamioneta;
    cantidad: number;
    motivo?: string;
    // true (por defecto): la carga sale del depósito / la descarga vuelve al depósito.
    afectaStockGeneral?: boolean;
}

export interface MovimientoCamionetaResultado {
    stockCamioneta: number;
    stockGeneral: number;
}

export interface CargaCamionetaResultado {
    afectaStockGeneral: boolean;
    lineas: { productoId: string; stockCamioneta: number; stockGeneral: number }[];
}
