import { Component, OnInit, inject, signal } from "@angular/core";
import { RouterLink, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Api, Notice, errorText } from "./api";
import { Listing, statusNames, offerNames } from "./data";
import { Card, Icon } from "./shared";

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, Card, Icon],
  template: ` <section class="wrap page-head">
      <div class="section-heading">
        <div>
          <h1>{{ mine ? "Minhas colheitas." : "Guardados com carinho." }}</h1>
          <p>
            {{
              mine
                ? "Acompanhe suas ofertas e mantenha a disponibilidade em dia."
                : "Aquelas ofertas que você quer ver de novo."
            }}
          </p>
        </div>
        @if (mine) {
          <a routerLink="/publicar" class="button primary"
            ><vp-icon name="Plus" /> Publicar oferta</a
          >
        }
      </div>
    </section>
    <section class="wrap">
      @if (error()) {
        <div class="error" role="alert">
          {{ error() }}
          <button class="text-link" (click)="load()">Tentar novamente</button>
        </div>
      }
      @if (loading()) {
        <div class="loading" role="status">Carregando suas ofertas…</div>
      }
      @if (mine) {
        <div class="manage-list">
          @for (l of items(); track l.id) {
            <article class="manage-item">
              <a [routerLink]="['/ofertas', l.id]"
                ><img
                  [src]="l.image_url || '/assets/product-default.svg'"
                  [alt]="l.title"
              /></a>
              <div class="manage-copy">
                <span [class]="'tag ' + l.offer_type">{{
                  offers[l.offer_type]
                }}</span
                ><a [routerLink]="['/ofertas', l.id]"
                  ><h2>{{ l.title }}</h2></a
                >
                <p>
                  {{ l.neighborhood }} ·
                  <span [class]="'status ' + l.status">{{
                    statuses[l.status]
                  }}</span>
                </p>
              </div>
              <form class="availability-form" (ngSubmit)="update(l)">
                <label
                  >Quantidade<input
                    type="number"
                    name="quantity"
                    min="0"
                    max="1000000"
                    step="0.01"
                    [(ngModel)]="l.quantity"
                    required /></label
                ><label
                  >Status<select name="status" [(ngModel)]="l.status">
                    <option value="available">Disponível</option>
                    <option value="reserved">Reservado</option>
                    <option value="unavailable">Indisponível</option>
                    <option value="completed">Concluído</option>
                  </select></label
                ><button
                  type="submit"
                  class="button secondary"
                  [disabled]="busy() === l.id"
                >
                  Salvar
                </button>
              </form>
              <div class="manage-actions">
                <a
                  [routerLink]="['/ofertas', l.id, 'editar']"
                  class="icon-button"
                  aria-label="Editar oferta"
                  ><vp-icon name="Pencil" /></a
                ><button
                  class="icon-button danger"
                  (click)="remove(l)"
                  aria-label="Excluir oferta"
                  [disabled]="busy() === l.id"
                >
                  <vp-icon name="Trash2" />
                </button>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="offer-grid">
          @for (l of items(); track l.id) {
            <div>
              <vp-card [listing]="l" /><button
                class="text-link remove-favorite"
                (click)="removeFavorite(l)"
                [disabled]="busy() === l.id"
              >
                <vp-icon name="HeartOff" /> Remover dos favoritos
              </button>
            </div>
          }
        </div>
      }
      @if (!loading() && !error() && !items().length) {
        <div class="empty">
          <vp-icon [name]="mine ? 'Sprout' : 'Heart'" />
          <h2>
            {{
              mine
                ? "Sua próxima colheita começa aqui."
                : "Ainda não guardou nenhuma oferta?"
            }}
          </h2>
          <p>
            {{
              mine
                ? "Compartilhe o que você tem de bom."
                : "Explore a comunidade e salve o que chamar sua atenção."
            }}
          </p>
          <a
            [routerLink]="mine ? '/publicar' : '/explorar'"
            class="button primary"
            >{{
              mine ? "Publicar minha primeira oferta" : "Explorar ofertas"
            }}</a
          >
        </div>
      }
    </section>`,
})
export class Collections implements OnInit {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private notice = inject(Notice);
  mine = this.route.snapshot.url[0]?.path === "meus-anuncios";
  items = signal<Listing[]>([]);
  error = signal("");
  loading = signal(true);
  busy = signal<number | null>(null);
  statuses = statusNames;
  offers = offerNames;
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set("");
    try {
      this.items.set(
        await this.api.get<Listing[]>(
          this.mine ? "/users/me/listings" : "/favorites",
        ),
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }
  async update(l: Listing) {
    this.busy.set(l.id);
    this.error.set("");
    try {
      const result = await this.api.patch<Listing>(
        "/listings/" + l.id + "/availability",
        { quantity: l.quantity, status: l.status },
      );
      this.items.update((items) =>
        items.map((i) => (i.id === l.id ? result : i)),
      );
      this.notice.show("Disponibilidade atualizada.");
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(null);
    }
  }
  async remove(l: Listing) {
    if (
      !window.confirm(
        "Excluir a oferta “" +
          l.title +
          "”? Ela deixará de aparecer na comunidade.",
      )
    )
      return;
    this.busy.set(l.id);
    try {
      await this.api.delete("/listings/" + l.id);
      this.items.update((items) => items.filter((i) => i.id !== l.id));
      this.notice.show(
        "Oferta excluída. O histórico das conversas foi preservado.",
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(null);
    }
  }
  async removeFavorite(l: Listing) {
    this.busy.set(l.id);
    try {
      await this.api.delete("/favorites/" + l.id);
      this.items.update((items) => items.filter((i) => i.id !== l.id));
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(null);
    }
  }
}
