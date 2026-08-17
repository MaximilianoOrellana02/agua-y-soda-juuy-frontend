import { TipoCliente } from './cliente.model';

export interface PrecioProducto {
    id: string;
    productoId: string;
    tipoCliente: TipoCliente;
    precio: number;
    fechaDesde: string;
}

export interface Producto {
    id: string;
    nombre: string;
    esRetornable: boolean;
    activo: boolean;
    stockActual: number;
    stockMinimo: number;
    precios?: PrecioProducto[];
}

export interface ProductoInput {
    nombre: string;
    esRetornable?: boolean;
    precioParticular: number;
    precioConfianza: number;
}

export interface MovimientoStock {
    id: string;
    productoId: string;
    usuarioId: string;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    motivo: string | null;
    fecha: string;
    producto?: { id: string; nombre: string };
    usuario?: { id: string; nombreCompleto: string };
}

export function precioVigente(producto: Producto, tipoCliente: TipoCliente): number | null {
    const precio = producto.precios?.find((p) => p.tipoCliente === tipoCliente);
    return precio ? Number(precio.precio) : null;
}