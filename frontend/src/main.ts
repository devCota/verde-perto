import { Component, inject, signal, LOCALE_ID } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
  provideRouter,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Routes,
  withInMemoryScrolling,
  withHashLocation,
} from "@angular/router";
import { provideHttpClient } from "@angular/common/http";
import { registerLocaleData } from "@angular/common";
import pt from "@angular/common/locales/pt";
import { Auth, Notice, authGuard, errorText } from "./app/api";
import { Icon } from "./app/shared";
import { demoMode } from "./app/runtime";
registerLocaleData(pt);

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<section class="wrap empty">
    <h1>Esse caminho ainda não foi cultivado.</h1>
    <p>A página que você procura não foi encontrada.</p>
    <a routerLink="/" class="button primary">Voltar ao início</a>
  </section>`,
})
class NotFound {}
const routes: Routes = [
  {
    path: "",
    loadComponent: () => import("./app/home").then((m) => m.Home),
    pathMatch: "full",
  },
  {
    path: "explorar",
    loadComponent: () => import("./app/explore").then((m) => m.Explore),
  },
  {
    path: "mapa",
    loadComponent: () => import("./app/explore").then((m) => m.Explore),
  },
  {
    path: "entrar",
    loadComponent: () => import("./app/auth-page").then((m) => m.AuthPage),
  },
  {
    path: "cadastro",
    loadComponent: () => import("./app/auth-page").then((m) => m.AuthPage),
  },
  {
    path: "publicar",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./app/listing-form").then((m) => m.ListingForm),
  },
  {
    path: "ofertas/:id/editar",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./app/listing-form").then((m) => m.ListingForm),
  },
  {
    path: "ofertas/:id",
    loadComponent: () => import("./app/detail").then((m) => m.Detail),
  },
  {
    path: "meus-anuncios",
    canActivate: [authGuard],
    loadComponent: () => import("./app/collections").then((m) => m.Collections),
  },
  {
    path: "favoritos",
    canActivate: [authGuard],
    loadComponent: () => import("./app/collections").then((m) => m.Collections),
  },
  {
    path: "conversas/:id",
    canActivate: [authGuard],
    loadComponent: () => import("./app/chat").then((m) => m.Chat),
  },
  {
    path: "conversas",
    canActivate: [authGuard],
    loadComponent: () => import("./app/chat").then((m) => m.Chat),
  },
  {
    path: "perfil",
    canActivate: [authGuard],
    loadComponent: () => import("./app/profile").then((m) => m.Profile),
  },
  {
    path: "perfil/:id",
    loadComponent: () => import("./app/profile").then((m) => m.Profile),
  },
  { path: "**", component: NotFound },
];

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <a href="#main" class="skip-link" (click)="skipToContent($event)">Pular para o conteúdo</a>
    <div class="top-note">
      Pequenas colheitas. Grandes conexões.
      <span>Feito para compartilhar.</span>
    </div>
    @if (demo) {
      <aside class="demo-banner" aria-label="Demonstração do VerdePerto">
        <div class="wrap demo-banner-inner">
          <p><strong>Demonstração interativa.</strong> Dados salvos só neste navegador. Use informações fictícias.</p>
          <div class="demo-banner-actions">
            <a routerLink="/entrar" class="text-link">{{ auth.user() ? "Trocar conta" : "Usar conta de teste" }}</a>
            <button type="button" class="text-link" (click)="reset()">Recomeçar demonstração</button>
          </div>
        </div>
      </aside>
    }
    <header class="site-header">
      <div class="wrap header-inner">
        <a routerLink="/" class="brand" aria-label="VerdePerto início"
          ><img src="assets/logo.svg" alt="" width="38" height="38" /><span
            >Verde<span>Perto</span><small>cultivando conexões</small></span
          ></a
        >
        <nav class="main-nav" aria-label="Navegação principal">
          <a routerLink="/explorar" routerLinkActive="active">Explorar</a
          ><a routerLink="/mapa" routerLinkActive="active"
            ><vp-icon name="Map" /> Mapa</a
          ><a routerLink="/" fragment="como-funciona" class="how-link"
            >Como funciona</a
          >
        </nav>
        <div class="header-actions">
          @if (auth.user(); as u) {
            <a
              routerLink="/conversas"
              class="icon-button desktop-only"
              aria-label="Conversas"
              ><vp-icon name="MessagesSquare" /></a
            ><a
              routerLink="/favoritos"
              class="icon-button desktop-only"
              aria-label="Favoritos"
              ><vp-icon name="Heart"
            /></a>
            <div class="user-menu">
              <button
                class="avatar-button"
                (click)="menu.update(toggle)"
                [attr.aria-expanded]="menu()"
                aria-label="Abrir menu da conta"
              >
                <span class="avatar small">{{ u.name.charAt(0) }}</span
                ><vp-icon name="ChevronDown" />
              </button>
              @if (menu()) {
                <div class="dropdown" (click)="menu.set(false)">
                  <strong>{{ u.name }}</strong
                  ><a routerLink="/perfil">Meu perfil</a
                  ><a routerLink="/meus-anuncios">Meus anúncios</a
                  ><a routerLink="/favoritos">Favoritos</a
                  ><a routerLink="/conversas">Conversas</a
                  ><button (click)="logout()">Sair da conta</button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/entrar" class="login-link">Entrar</a>
          }
          <a routerLink="/publicar" class="button primary header-publish"
            ><vp-icon name="Plus" /> <span>Compartilhar</span></a
          >
        </div>
      </div>
    </header>
    <main id="main" tabindex="-1"><router-outlet /></main>
    <footer class="site-footer">
      <div class="wrap footer-inner">
        <a routerLink="/" class="brand"
          ><img src="assets/logo.svg" alt="" width="32" height="32" /><span
            >Verde<span>Perto</span></span
          ></a
        >
        <p>Compartilhe o que a natureza oferece.</p>
        <div>
          <a routerLink="/explorar">Explorar</a><a routerLink="/mapa">Mapa</a
          ><a routerLink="/publicar">Compartilhar</a>
        </div>
      </div>
      <div class="wrap footer-bottom">
        <span>Um projeto acadêmico feito para aproximar pessoas.</span
        ><span><vp-icon name="Sprout" /> Cultive. Compartilhe. Conecte.</span>
      </div>
    </footer>
    <nav class="mobile-nav" aria-label="Navegação no celular">
      <a routerLink="/explorar" routerLinkActive="active"
        ><vp-icon name="Search" />Explorar</a
      ><a routerLink="/mapa" routerLinkActive="active"
        ><vp-icon name="Map" />Mapa</a
      ><a routerLink="/publicar" routerLinkActive="active"
        ><vp-icon name="PlusCircle" />Publicar</a
      ><a routerLink="/conversas" routerLinkActive="active"
        ><vp-icon name="MessagesSquare" />Conversas</a
      ><a routerLink="/perfil" routerLinkActive="active"
        ><vp-icon name="UserRound" />Perfil</a
      >
    </nav>
    @if (notice.text()) {
      <div class="toast" role="status">
        <vp-icon name="CheckCircle2" />{{ notice.text()
        }}<button (click)="notice.text.set('')" aria-label="Fechar aviso">
          <vp-icon name="X" />
        </button>
      </div>
    }
  `,
})
class App {
  demo = demoMode;
  auth = inject(Auth);
  notice = inject(Notice);
  menu = signal(false);
  toggle = (v: boolean) => !v;
  skipToContent(event: Event) {
    event.preventDefault();
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
    main?.scrollIntoView();
  }
  async reset() {
    if (!window.confirm("Recomeçar a demonstração? Contas, ofertas, fotos e mensagens criadas neste navegador serão apagadas. Os exemplos iniciais serão restaurados.")) return;
    try {
      await (await import("./app/demo-api")).resetDemo();
      window.location.assign(new URL("./", document.baseURI).href);
    } catch {
      this.notice.show("Não foi possível restaurar os exemplos. Permita o armazenamento do site no navegador.");
    }
  }
  async logout() {
    try {
      await this.auth.logout();
    } catch (e) {
      this.notice.show(errorText(e));
    }
  }
}
bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter(
      routes,
      ...(demoMode ? [withHashLocation()] : []),
      withInMemoryScrolling({
        anchorScrolling: "enabled",
        scrollPositionRestoration: "enabled",
      }),
    ),
    { provide: LOCALE_ID, useValue: "pt-BR" },
  ],
}).catch(console.error);
