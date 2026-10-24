import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { Api, errorText, Notice } from "./api";
import { Page, Listing, categories, regions } from "./data";
import { Card, Icon } from "./shared";
import { OfferMap } from "./map";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Card, Icon, OfferMap],
  template: ` <section class="wrap page-head">
      <a routerLink="/" class="breadcrumb">Início <span>/</span> Explorar</a>
      <div class="section-heading">
        <div>
          <h1>Encontre sua próxima colheita.</h1>
          <p>Descubra produtos e pessoas na sua região.</p>
        </div>
        <a routerLink="/publicar" class="button primary"
          ><vp-icon name="Plus" /> Publicar oferta</a
        >
      </div>
    </section>
    <section class="wrap">
      <form class="filter-panel" (ngSubmit)="filter()">
        <div class="search-field">
          <vp-icon name="Search" /><input
            name="q"
            [(ngModel)]="q"
            aria-label="Buscar produtos"
            placeholder="Busque por limões, mudas, temperos…"
          /><button class="button primary" type="submit">Buscar</button>
        </div>
        <div class="filter-row">
          <label
            >Categoria<select
              name="category"
              [(ngModel)]="category"
              (change)="filter()"
            >
              <option value="">Todas as categorias</option>
              @for (c of categories; track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select></label
          ><label
            >Modalidade<select
              name="offer"
              [(ngModel)]="offer"
              (change)="filter()"
            >
              <option value="">Doação, troca e venda</option>
              <option value="donation">Doação</option>
              <option value="exchange">Troca</option>
              <option value="sale">Venda</option>
            </select></label
          ><label
            >Disponibilidade<select
              name="status"
              [(ngModel)]="status"
              (change)="filter()"
            >
              <option value="available">Disponíveis</option>
              <option value="reserved">Reservados</option>
              <option value="completed">Concluídos</option>
              <option value="">Todos os estados</option>
            </select></label
          ><label
            >Ordenar por<select
              name="sort"
              [(ngModel)]="sort"
              (change)="filter()"
            >
              <option value="recent">Mais recentes</option>
              <option value="nearest">Mais próximos</option>
            </select></label
          >
        </div>
      </form>
      <div class="results-toolbar">
        <div class="region-picker">
          <vp-icon name="MapPin" /><label class="sr-only" for="region"
            >Sua região de referência</label
          ><select
            id="region"
            name="region"
            [(ngModel)]="regionIndex"
            (change)="chooseRegion()"
          >
            @for (r of regions; track r.name; let i = $index) {
              <option [ngValue]="i">{{ r.name }}</option>
            }</select
          ><button
            class="icon-button"
            (click)="locate()"
            aria-label="Usar minha localização"
            title="Usar minha localização"
          >
            <vp-icon name="LocateFixed" />
          </button>
        </div>
        <div class="view-toggle" aria-label="Visualização">
          <button
            (click)="setView(false)"
            [class.active]="!mapView()"
            [attr.aria-pressed]="!mapView()"
          >
            <vp-icon name="LayoutGrid" /> Lista</button
          ><button
            (click)="setView(true)"
            [class.active]="mapView()"
            [attr.aria-pressed]="mapView()"
          >
            <vp-icon name="Map" /> Mapa
          </button>
        </div>
      </div>
      <div class="result-summary" aria-live="polite">
        <span
          >{{ total() }}
          {{ total() === 1 ? "oferta encontrada" : "ofertas encontradas" }}
          @if (mapView() && total() > 100) {
            · exibindo as 100 mais próximas
          }</span
        ><button class="text-link" (click)="clear()">Limpar filtros</button>
      </div>
      @if (error()) {
        <div class="error" role="alert">
          {{ error() }}
          <button class="text-link" (click)="load()">Tentar novamente</button>
        </div>
      }
      @if (loading()) {
        <div class="loading" role="status">Procurando ofertas…</div>
      }
      @if (!loading() && mapView()) {
        <vp-map [listings]="items()" [lat]="lat" [lng]="lng" />
      }
      @if (!mapView()) {
        <div class="offer-grid">
          @for (l of items(); track l.id) {
            <vp-card [listing]="l" />
          }
        </div>
      }
      @if (!loading() && !items().length && !error()) {
        <div class="empty">
          <vp-icon name="Search" />
          <h2>Nenhuma oferta por enquanto.</h2>
          <p>
            Tente outra categoria ou modalidade. Uma nova colheita pode aparecer
            logo.
          </p>
          <button class="button secondary" (click)="clear()">
            Limpar filtros
          </button>
        </div>
      }
      @if (!mapView() && total() > 12) {
        <nav class="pagination" aria-label="Paginação">
          <button
            class="button secondary"
            [disabled]="page <= 1 || loading()"
            (click)="changePage(-1)"
          >
            Anterior</button
          ><span>Página {{ page }} de {{ pages() }}</span
          ><button
            class="button secondary"
            [disabled]="page * 12 >= total() || loading()"
            (click)="changePage(1)"
          >
            Próxima
          </button>
        </nav>
      }
    </section>`,
})
export class Explore implements OnInit, OnDestroy {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notice = inject(Notice);
  private sub?: Subscription;
  private request = 0;
  categories = categories;
  regions = regions;
  q = "";
  category = "";
  offer = "";
  status = "available";
  sort = "recent";
  page = 1;
  regionIndex = 0;
  lat = -19.94;
  lng = -44.04;
  items = signal<Listing[]>([]);
  total = signal(0);
  mapView = signal(false);
  loading = signal(false);
  error = signal("");
  ngOnInit() {
    this.mapView.set(this.route.snapshot.url.some((s) => s.path === "mapa"));
    this.sub = this.route.queryParamMap.subscribe((p) => {
      this.q = p.get("q") || "";
      this.category = p.get("category") || "";
      this.offer = p.get("offer_type") || "";
      this.status = p.get("status") ?? "available";
      this.sort = p.get("sort") || "recent";
      this.page = Math.max(1, Number(p.get("page")) || 1);
      void this.load();
    });
  }
  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.request++;
  }
  async load() {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set("");
    try {
      const result = await this.api.get<Page>("/listings", {
        q: this.q,
        category: this.category,
        offer_type: this.offer,
        status: this.status,
        sort: this.sort,
        lat: this.lat,
        lng: this.lng,
        page: this.mapView() ? 1 : this.page,
        page_size: this.mapView() ? 100 : 12,
      });
      if (request === this.request) {
        this.items.set(result.items);
        this.total.set(result.total);
      }
    } catch (e) {
      if (request === this.request) this.error.set(errorText(e));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  filter() {
    this.page = 1;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.q,
        category: this.category,
        offer_type: this.offer,
        status: this.status,
        sort: this.sort,
      },
      replaceUrl: true,
    });
  }
  clear() {
    this.q = this.category = this.offer = "";
    this.status = "available";
    this.sort = "recent";
    this.filter();
  }
  chooseRegion() {
    const r = regions[this.regionIndex];
    this.lat = r.lat;
    this.lng = r.lng;
    this.sort = "nearest";
    void this.load();
  }
  locate() {
    if (!navigator.geolocation) {
      this.notice.show("Escolha sua região manualmente na lista.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.lat = Math.round(p.coords.latitude * 100) / 100;
        this.lng = Math.round(p.coords.longitude * 100) / 100;
        this.sort = "nearest";
        void this.load();
        this.notice.show(
          "Região aproximada atualizada. Sua localização exata não foi enviada.",
        );
      },
      () =>
        this.notice.show(
          "Não foi possível obter sua localização. Escolha uma região na lista.",
        ),
      { timeout: 10000, enableHighAccuracy: false },
    );
  }
  setView(map: boolean) {
    this.mapView.set(map);
    this.page = 1;
    void this.load();
  }
  changePage(change: number) {
    this.page += change;
    void this.load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  pages() {
    return Math.ceil(this.total() / 12);
  }
}
