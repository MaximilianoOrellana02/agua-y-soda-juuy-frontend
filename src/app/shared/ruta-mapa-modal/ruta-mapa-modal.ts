import '../leaftlet-setup';
import { Component, input, output, afterNextRender, ElementRef, viewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Cliente } from '../../core/models/cliente.model';
import { armarLinkGoogleMaps, calcularRutaOptima, PuntoRuta } from '../ruta-optima.util';
import { DecimalPipe } from '@angular/common';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-ruta-mapa-modal',
  imports: [DecimalPipe],
  templateUrl: './ruta-mapa-modal.html',
  styleUrl: './ruta-mapa-modal.css',
})
export default class RutaMapaModal {
  private router = inject(Router);

  clientes = input.required<Cliente[]>();
  cerrar = output<void>();

  private contenedor = viewChild.required<ElementRef<HTMLDivElement>>('mapaContenedor');
  private mapa?: L.Map

  clientesOrdenados = signal<Cliente[]>([]);
  calculandoRuta = signal(true);
  errorRuta = signal<string | null>(null);
  distanciaKm = signal(0);
  duracionMin = signal(0);
  ubicacionActual = signal<PuntoRuta | null>(null);

  constructor() {
    afterNextRender(() => {
      this.mapa = L.map(this.contenedor().nativeElement, {
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.mapa);

      this.iniciarCalculoRuta();
    });
  }

  private async iniciarCalculoRuta() {
    const clientesConUbicacion = this.clientes().filter((c) => c.latitud != null && c.longitud != null);

    if (clientesConUbicacion.length === 0) {
      this.mostrarSinRuta(clientesConUbicacion);
      return;
    }

    try {
      const inicio = await this.obtenerUbicacionActual();
      this.ubicacionActual.set(inicio);

      const resultado = await calcularRutaOptima(inicio, clientesConUbicacion as (Cliente & PuntoRuta)[]);

      if (!resultado) {
        this.errorRuta.set('No se pudo calcular la ruta óptima. Mostrando el orden original.');
        this.mostrarSinRuta(clientesConUbicacion);
        return;
      }

      this.clientesOrdenados.set(resultado.ordenados as Cliente[]);
      this.distanciaKm.set(resultado.distanciaKm);
      this.duracionMin.set(resultado.duracionMin);
      this.dibujarMapa(inicio, resultado.ordenados as (Cliente & PuntoRuta)[], resultado.geometria);
      this.calculandoRuta.set(false);
    } catch (error) {
      console.error('Error al obtener ubicación o calcular ruta:', error);
      this.errorRuta.set('No se pudo obtener tu ubicación. Activá el GPS y dale permiso a la app.');
      this.mostrarSinRuta(clientesConUbicacion);
    }
  }

  private mostrarSinRuta(clientes: Cliente[]) {
    this.clientesOrdenados.set(clientes);
    this.calculandoRuta.set(false);

    if (this.mapa && clientes.length > 0) {
      const marcadores = clientes.map((c) => L.marker([c.latitud!, c.longitud!]).addTo(this.mapa!));
      const grupo = L.featureGroup(marcadores);
      this.mapa.fitBounds(grupo.getBounds().pad(0.15));
    } else if (this.mapa) {
      this.mapa.setView([-24.1858, -65.2995], 13);
    }
  }

  private dibujarMapa(inicio: PuntoRuta, clientesOrdenados: (Cliente & PuntoRuta)[], geometria: [number, number][]) {
    if (!this.mapa) return;

    const iconoInicio = L.divIcon({
      className: 'marcador-inicio',
      html: '<i class="bi bi-geo-alt-fill"></i>',
      iconSize: [30, 30],
    });
    L.marker([inicio.latitud, inicio.longitud], { icon: iconoInicio }).addTo(this.mapa);

    clientesOrdenados.forEach((c, i) => {
      const iconoNumerado = L.divIcon({
        className: 'marcador-numerado',
        html: `<span>${i + 1}</span>`,
        iconSize: [28, 28],
      });
      L.marker([c.latitud, c.longitud], { icon: iconoNumerado })
        .addTo(this.mapa!)
        .bindPopup(`<strong>${i + 1}. ${c.apellido}, ${c.nombre}</strong><br>${c.direccion ?? ''}`);
    });

    const linea = L.polyline(geometria, { color: '#0e7c86', weight: 4, opacity: 0.8 }).addTo(this.mapa);

    this.mapa.fitBounds(linea.getBounds().pad(0.1));
  }

  irACliente(id: string) {
    this.router.navigate(['/clientes', id]);
    this.cerrar.emit();
  }

  iniciarNavegacion() {
    const inicio = this.ubicacionActual();
    const clientes = this.clientesOrdenados().filter((c) => c.latitud != null && c.longitud != null);

    if (!inicio || clientes.length === 0) return;

    const link = armarLinkGoogleMaps(
      inicio,
      clientes.map((c) => ({ latitud: c.latitud!, longitud: c.longitud! }))
    );

    window.open(link, '_blank');
  }

  compartirPorWhatsapp() {
    const lista = this.clientesOrdenados().length > 0 ? this.clientesOrdenados() : this.clientes();

    const lineas = lista.map((c, i) => {
      const direccion = c.direccion ? `\n📍 ${c.direccion}` : '';
      const telefono = c.telefono ? `\n📞 ${c.telefono}` : '';
      const deuda = c.saldoActual > 0 ? `\n💰 Debe $${c.saldoActual}` : '';
      return `${i + 1}. ${c.apellido}, ${c.nombre}${direccion}${telefono}${deuda}`;
    });

    const fechaHoy = new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const texto = `🚚 Ruta de Hoy (${fechaHoy})\n\n${lineas.join('\n\n')}\n\nTotal paradas pendientes: ${lista.length}`;

    if (navigator.share) {
      navigator.share({ title: 'Ruta de Hoy', text: texto }).catch(() => { });
      return;
    }

    const encoded = encodeURIComponent(texto);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  }

  clientesSinUbicacion(): number {
    return this.clientes().filter((c) => c.latitud == null || c.longitud == null).length;
  }

  private async obtenerUbicacionActual(): Promise<PuntoRuta> {
    if (Capacitor.isNativePlatform()) {
      const posicion = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000, // máximo 15 segundos esperando señal GPS
      });
      return { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        reject(new Error('Geolocalización no disponible en este contexto'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  reintentar() {
    this.errorRuta.set(null);
    this.calculandoRuta.set(true);
    this.iniciarCalculoRuta();
  }
}