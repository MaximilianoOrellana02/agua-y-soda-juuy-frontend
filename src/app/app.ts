import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import Toast from "./shared/toast/toast";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('soderia-frontend');
  constructor(private router: Router, private location: Location) { }
  private themeService = inject(ThemeService)

  ngOnInit() {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorApp.addListener('backButton', () => {
      const rutaActual = this.router.url;

      if (rutaActual == '/cliente' || rutaActual === '/login') {
        if (confirm('¿Salir de app?')) {
          CapacitorApp.exitApp();
        }
        return;
      }

      this.location.back();
    })
  }
}
