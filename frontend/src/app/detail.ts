import { Component, inject, signal, OnInit } from "@angular/core";
import { DatePipe, CurrencyPipe } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, Auth, Notice, errorText } from "./api";
import {
  Listing,
  Conversation,
  offerNames,
  statusNames,
  categories,
} from "./data";
import { Icon } from "./shared";

@Component({
  standalone: true,
  imports: [RouterLink, Icon, DatePipe, CurrencyPipe],
  template: `
    <section class="wrap page-head">
      <a routerLink="/explorar" class="back-link"
        ><vp-icon name="ArrowLeft" /> Voltar às ofertas</a
      >
    </section>
    @if (error()) {
      <div class="wrap error" role="alert">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="wrap loading" role="status">Carregando esta colheita…</div>
    }
    @if (listing(); as l) {
      <section class="wrap detail-layout">
        <div class="detail-photo">
          <img
            [src]="l.image_url || 'assets/product-default.svg'"
            [alt]="l.title"
            (error)="fallback($event)"
          /><span [class]="'tag ' + l.offer_type">{{
            offers[l.offer_type]
          }}</span>
        </div>
        <div class="detail-info">
          <h1>{{ l.title }}</h1>
          <p class="location">
            <vp-icon name="MapPin" /> {{ l.neighborhood }}, {{ l.city }} ·
            região aproximada
          </p>
          <p class="category-meta">Categoria: {{ categoryName(l.category) }}</p>
          <div class="detail-price">
            @if (l.offer_type === "sale") {
              <strong>{{
                l.price | currency: "BRL" : "symbol" : "1.2-2" : "pt-BR"
              }}</strong
              ><span
                >por {{ l.unit === "kg" ? "kg" : "unidade de medida" }}</span
              >
            } @else {
              <strong>{{
                l.offer_type === "donation"
                  ? "Para compartilhar."
                  : "Vamos fazer uma troca?"
              }}</strong>
            }
          </div>
          <div class="facts">
            <div>
              <span>Quantidade</span
              ><strong>{{ l.quantity }} {{ l.unit }}</strong>
            </div>
            <div>
              <span>Disponibilidade</span
              ><strong [class]="'status ' + l.status">{{
                statuses[l.status]
              }}</strong>
            </div>
          </div>
          @if (l.exchange_for && l.offer_type === "exchange") {
            <div class="exchange-note">
              <vp-icon name="ArrowLeftRight" />
              <p><strong>Interesse na troca</strong>{{ l.exchange_for }}</p>
            </div>
          }
          <h2>Sobre esta oferta</h2>
          <p class="description">{{ l.description }}</p>
          <small>Publicado em {{ l.created_at | date: "dd/MM/yyyy" }}</small>
          <div class="detail-actions">
            @if (auth.user()?.id === l.owner_id) {
              <a
                [routerLink]="['/ofertas', l.id, 'editar']"
                class="button primary"
                ><vp-icon name="Pencil" /> Editar minha oferta</a
              >
            } @else {
              <button
                class="button primary"
                (click)="chat()"
                [disabled]="
                  busy() || !['available', 'reserved'].includes(l.status)
                "
              >
                <vp-icon name="MessagesSquare" /> Conversar com anunciante
              </button>
            }
            <button
              class="button secondary"
              (click)="favorite()"
              [disabled]="busy()"
              [attr.aria-pressed]="saved()"
            >
              <vp-icon name="Heart" /> {{ saved() ? "Salvo" : "Salvar" }}
            </button>
          </div>
          <a [routerLink]="['/perfil', l.owner_id]" class="owner-panel"
            ><span class="avatar">{{ l.owner.name.charAt(0) }}</span
            ><span
              ><strong>{{ l.owner.name }}</strong
              ><small
                >Na comunidade desde
                {{ l.owner.created_at | date: "MM/yyyy" }}</small
              ></span
            ><vp-icon name="ArrowUpRight"
          /></a>
          <p class="privacy-note">
            <vp-icon name="ShieldCheck" /> Combine a retirada pelo chat e
            prefira um ponto público. O mapa não mostra residências.
          </p>
        </div>
      </section>
    }
  `,
})
export class Detail implements OnInit {
  api = inject(Api);
  auth = inject(Auth);
  route = inject(ActivatedRoute);
  router = inject(Router);
  notice = inject(Notice);
  listing = signal<Listing | null>(null);
  saved = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal("");
  offers = offerNames;
  statuses = statusNames;
  async ngOnInit() {
    try {
      const l = await this.api.get<Listing>(
        "/listings/" + this.route.snapshot.paramMap.get("id"),
      );
      this.listing.set(l);
      await this.auth.ready;
      if (this.auth.user())
        this.saved.set(
          (await this.api.get<Listing[]>("/favorites")).some(
            (f) => f.id === l.id,
          ),
        );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }
  categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name;
  }
  requireLogin() {
    if (this.auth.user()) return true;
    void this.router.navigate(["/entrar"], {
      queryParams: { next: this.router.url },
    });
    return false;
  }
  async favorite() {
    if (!this.requireLogin()) return;
    this.busy.set(true);
    try {
      const id = this.listing()!.id;
      if (this.saved()) await this.api.delete("/favorites/" + id);
      else await this.api.post("/favorites/" + id);
      this.saved.update((v) => !v);
      this.notice.show(
        this.saved()
          ? "Oferta salva nos seus favoritos."
          : "Oferta removida dos favoritos.",
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
  async chat() {
    if (!this.requireLogin()) return;
    this.busy.set(true);
    try {
      const c = await this.api.post<Conversation>("/conversations", {
        listing_id: this.listing()!.id,
      });
      await this.router.navigate(["/conversas", c.id]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
  fallback(e: Event) {
    const image = e.target as HTMLImageElement;
    image.onerror = null;
    image.src = "assets/product-default.svg";
  }
}
