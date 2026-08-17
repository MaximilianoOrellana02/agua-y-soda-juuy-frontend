export interface Pedido {
    id: string;
    clienteId: string;
    detalle: string;
    estado: "pendiente" | "entregado";
    fecha: string;
    cliente?: {
        id: string;
        nombre: string;
        apellido: string;
        telefono: string | null
    }
}