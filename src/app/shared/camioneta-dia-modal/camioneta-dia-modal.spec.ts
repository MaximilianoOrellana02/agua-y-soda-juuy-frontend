import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import CamionetaDiaModal from './camioneta-dia-modal';
import { CamionetaService } from '../../core/services/camioneta.service';
import { ProductoService } from '../../core/services/producto.service';
import { RepartoService } from '../../core/services/reparto.service';

describe('Inicio del reparto: elegir y cargar camioneta', () => {
  let component: CamionetaDiaModal;
  const camioneta = { id: 'c1', nombre: 'Camioneta 1', patente: null, activa: true };
  const elegir = vi.fn();
  const cargar = vi.fn();
  const dejar = vi.fn();
  const cerrado = vi.fn();
  const registrarComienzo = vi.fn();
  const comenzadoHoy = signal(false);

  beforeEach(() => {
    elegir.mockReset().mockReturnValue(of(camioneta));
    cargar.mockReset().mockReturnValue(of({ afectaStockGeneral: true, lineas: [] }));
    dejar.mockReset().mockReturnValue(of(null));
    cerrado.mockReset();
    registrarComienzo.mockReset().mockReturnValue(of({}));
    comenzadoHoy.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: RepartoService, useValue: { registrarComienzo, comenzadoHoy } },
        {
          provide: CamionetaService,
          useValue: {
            camionetaDelDia: signal(null),
            listar: () => of([camioneta]),
            stock: () => of({ camioneta, stock: [{ productoId: 'p1', cantidad: 3 }] }),
            elegir, cargar, dejar,
          },
        },
        {
          provide: ProductoService,
          useValue: {
            listar: () => of([
              { id: 'p1', nombre: 'Bidón 20 L', activo: true, stockActual: 10 },
              { id: 'p2', nombre: 'Sifón', activo: true, stockActual: 2 },
            ]),
          },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new CamionetaDiaModal());
    component.cerrar.subscribe(cerrado);
    component.ngOnInit();
  });

  it('después de elegir la camioneta pasa a cargarla mostrando lo que ya tiene', () => {
    component.elegir(camioneta);
    expect(elegir).toHaveBeenCalledWith('c1');
    expect(component.paso()).toBe('cargar');
    expect(component.yaTiene().map((l) => [l.nombre, l.enCamioneta])).toEqual([['Bidón 20 L', 3]]);
    expect(cerrado).not.toHaveBeenCalled();
  });

  it('carga solo los productos con cantidad y descuenta del depósito por defecto', () => {
    component.elegir(camioneta);
    const [bidon] = component.lineas();
    component.cambiarCantidad(bidon, 5);
    component.confirmarCarga();
    expect(cargar).toHaveBeenCalledWith('c1', [{ productoId: 'p1', cantidad: 5 }], true);
    expect(cerrado).toHaveBeenCalled();
  });

  it('no deja cargar más de lo que hay en el depósito, salvo que no se descuente', () => {
    component.elegir(camioneta);
    const sifon = component.lineas()[1];
    component.cambiarCantidad(sifon, 4);
    component.confirmarCarga();
    expect(cargar).not.toHaveBeenCalled();
    expect(component.error()).toContain('Sifón (hay 2)');

    component.descontarDeposito.set(false);
    component.confirmarCarga();
    expect(cargar).toHaveBeenCalledWith('c1', [{ productoId: 'p2', cantidad: 4 }], false);
  });

  it('"Ahora no" cierra sin cargar y "Hoy no uso camioneta" no llama al servidor si no había ninguna', () => {
    component.sinCamioneta();
    expect(dejar).not.toHaveBeenCalled();
    expect(registrarComienzo).toHaveBeenCalledTimes(1);
    expect(cerrado).toHaveBeenCalledTimes(1);
    expect(cargar).not.toHaveBeenCalled();
  });
});

describe('Elegir camioneta comienza el reparto una sola vez', () => {
  it('registra el comienzo al elegir y no lo repite si ya empezó', () => {
    const registrarComienzo = vi.fn().mockReturnValue(of({}));
    const comenzadoHoy = signal(false);
    const camioneta = { id: 'c1', nombre: 'Camioneta 1', patente: null, activa: true };
    TestBed.configureTestingModule({
      providers: [
        { provide: RepartoService, useValue: { registrarComienzo, comenzadoHoy } },
        {
          provide: CamionetaService,
          useValue: {
            camionetaDelDia: signal(null), listar: () => of([camioneta]),
            stock: () => of({ camioneta, stock: [] }), elegir: () => of(camioneta),
          },
        },
        { provide: ProductoService, useValue: { listar: () => of([]) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CamionetaDiaModal());
    component.elegir(camioneta);
    expect(registrarComienzo).toHaveBeenCalledTimes(1);
    expect(component.paso()).toBe('cargar');

    comenzadoHoy.set(true);
    component.volverAElegir();
    component.elegir(camioneta);
    expect(registrarComienzo).toHaveBeenCalledTimes(1);
  });
});
