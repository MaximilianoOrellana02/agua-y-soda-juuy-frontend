export interface PuntoRuta {
    latitud: number;
    longitud: number;
}

export interface ResultadoRutaOptima<T> {
    ordenados: T[];
    geometria: [number, number][];
    distanciaKm: number;
    duracionMin: number;
}

export async function calcularRutaOptima<T extends PuntoRuta>(
    inicio: PuntoRuta,
    puntos: T[]
): Promise<ResultadoRutaOptima<T> | null> {
    if (puntos.length === 0) return null;

    const coordenadas = [inicio, ...puntos]
        .map((p) => `${p.longitud},${p.latitud}`)
        .join(';');

    const url = `https://router.project-osrm.org/trip/v1/driving/${coordenadas}?source=first&roundtrip=false&geometries=geojson&overview=full`;

    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), 10000); // máximo 10 segundos esperando a OSRM

    try {
        const respuesta = await fetch(url, { signal: controlador.signal });
        clearTimeout(timeoutId);

        if (!respuesta.ok) return null;

        const datos = await respuesta.json();
        if (datos.code !== 'Ok') return null;

        const ordenPorIndice = datos.waypoints
            .slice(1)
            .map((w: any, i: number) => ({ punto: puntos[i], orden: w.waypoint_index }))
            .sort((a: any, b: any) => a.orden - b.orden)
            .map((x: any) => x.punto);

        const geometria: [number, number][] = datos.trips[0].geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
        );

        return {
            ordenados: ordenPorIndice,
            geometria,
            distanciaKm: datos.trips[0].distance / 1000,
            duracionMin: datos.trips[0].duration / 60,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}

export function armarLinkGoogleMaps(inicio: PuntoRuta, puntos: PuntoRuta[]): string {
    if (puntos.length === 0) return '';

    const destino = puntos[puntos.length - 1];
    const paradas = puntos.slice(0, -1);

    const origen = `${inicio.latitud},${inicio.longitud}`;
    const destinoStr = `${destino.latitud},${destino.longitud}`;
    const waypointsStr = paradas.map((p) => `${p.latitud},${p.longitud}`).join('|');

    const params = new URLSearchParams({
        api: '1',
        origin: origen,
        destination: destinoStr,
        travelmode: 'driving',
    });

    if (waypointsStr) {
        params.set('waypoints', waypointsStr);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
}