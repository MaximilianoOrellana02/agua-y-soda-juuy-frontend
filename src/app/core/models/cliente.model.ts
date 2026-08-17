export type TipoCliente = 'particular' | 'confianza';
export type CategoriaCliente = 'domicilio' | 'restaurante';


export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  direccion: string | null;
  telefono: string | null;
  localidad: string | null;
  barrioId: string | null;
  categoria: CategoriaCliente;
  saldoActual: number;
  tipoCliente: TipoCliente;
  saldosEnvase?: { productoId: string; cantidad: number }[];
  barrio?: { id: string; nombre: string };
  latitud: number | null;
  longitud: number | null;
  ultimaVisitaFecha: string | null;
}

export interface ClienteInput {
  nombre: string;
  apellido: string;
  direccion?: string;
  telefono?: string;
  localidad?: string;
  barrioId?: string;
  categoria?: CategoriaCliente;
  tipoCliente?: TipoCliente;
  latitud?: number | null;
  longitud?: number | null;
}

export interface ClienteDeudaVieja {
  id: string;
  nombre: string;
  apellido: string;
  saldoActual: number;
  diasSinPagar: number;
}