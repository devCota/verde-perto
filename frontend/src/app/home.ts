import { Component, inject, signal, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Api, errorText } from "./api";
import { Card, Icon } from "./shared";
import { Page, Listing, categories } from "./data";

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, Card, Icon],
  template: `
    <section class="hero wrap">
      <div class="hero-copy">
        <h1>Compartilhe o que<br />a natureza <span>oferece.</span></h1>
        <p>
          Frutas do quintal, mudas cheias de vida e boas trocas.<br
            class="desktop-only"
          />
          Tem muita coisa boa crescendo perto de você.
        </p>
        <form class="hero-search" (ngSubmit)="search()">
          <vp-icon name="Search" /><input
            name="q"
            [(ngModel)]="q"
            aria-label="O que você está procurando?"
            placeholder="O que você está procurando?"
          /><button class="button primary" type="submit">
            Explorar <vp-icon name="ArrowRight" />
          </button>
        </form>
        <div class="hero-caption">
          <vp-icon name="MapPin" /> Descubra sua comunidade, uma colheita de
          cada vez.
        </div>
        <a class="text-link hero-publish" routerLink="/publicar"
          >Tem algo para compartilhar? Publique uma oferta
          <vp-icon name="ArrowUpRight"
        /></a>
      </div>
      <div class="hero-visual">
        <img
          class="garden-photo"
          src="/assets/herbs.jpg"
          alt="Pequenas mudas crescendo em recipientes de cultivo"
        />
        <div class="harvest-note">
          <span class="note-icon"><vp-icon name="Sprout" /></span>
          <div>
            <strong>Coisas boas se multiplicam.</strong
            ><span>Principalmente quando a gente compartilha.</span>
          </div>
        </div>
        <span class="photo-label"
          ><vp-icon name="Leaf" /> Cultive conexões</span
        >
      </div>
    </section>
    <section class="category-section">
      <div class="wrap">
        <div class="section-heading">
          <div>
            <h2>Um pouco de tudo que cresce.</h2>
          </div>
          <a routerLink="/explorar" class="text-link"
            >Ver todas as ofertas <vp-icon name="ArrowRight"
          /></a>
        </div>
        <div class="categories">
          @for (c of categories; track c.id) {
            <a
              [routerLink]="['/explorar']"
              [queryParams]="{ category: c.id }"
              class="category"
              ><span><vp-icon [name]="c.icon" /></span>{{ c.name }}</a
            >
          }
        </div>
      </div>
    </section>
    <section class="wrap section-space">
      <div class="section-heading">
        <div>
          <h2>Daqui pertinho de você.</h2>
        </div>
        <a routerLink="/mapa" class="button secondary"
          ><vp-icon name="Map" /> Explorar no mapa</a
        >
      </div>
      @if (error()) {
        <div class="error" role="alert">
          {{ error() }}
          <button (click)="load()" class="text-link">Tentar novamente</button>
        </div>
      }
      @if (loading()) {
        <div class="loading" role="status">
          Buscando o que está crescendo por aqui…
        </div>
      }
      <div class="offer-grid">
        @for (l of listings(); track l.id) {
          <vp-card [listing]="l" />
        }
      </div>
      @if (!loading() && !error() && !listings().length) {
        <div class="empty">
          <vp-icon name="Sprout" />
          <h3>A primeira colheita pode ser a sua.</h3>
          <p>
            Ainda não há ofertas disponíveis. Compartilhe algo com a comunidade.
          </p>
          <a routerLink="/publicar" class="button primary"
            >Publicar uma oferta</a
          >
        </div>
      }
      @if (listings().length) {
        <div class="center section-bottom">
          <a routerLink="/explorar" class="button secondary"
            >Encontrar mais ofertas <vp-icon name="ArrowRight"
          /></a>
        </div>
      }
    </section>
    <section class="how-section wrap" id="como-funciona">
      <div class="how-intro">
        <h2>Uma pequena atitude.<br />Novas conexões.</h2>
        <p>
          O caminho entre o seu quintal e uma boa conversa pode ser bem curto.
        </p>
      </div>
      <div class="steps">
        <article>
          <span>01</span>
          <h3>Publique</h3>
          <p>
            Tem uma colheita sobrando ou mudas para dividir? Crie sua oferta.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Encontre</h3>
          <p>Explore a lista ou o mapa e descubra o que há na sua região.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Combine</h3>
          <p>
            Converse por aqui e combinem a troca ou retirada em um ponto
            público.
          </p>
        </article>
      </div>
    </section>
    @if (stats()) {
      <section class="wrap community-strip">
        <div>
          <vp-icon name="HeartHandshake" /><strong
            >A comunidade acontece com você.</strong
          >
        </div>
        <p>
          {{ stats()!.members }} participantes ·
          {{ stats()!.available }} ofertas disponíveis ·
          {{ stats()!.completed }} concluídas
        </p>
      </section>
    }
    <section class="wrap closing">
      <div>
        <h2>Seu excedente pode ser<br />o começo de uma conexão.</h2>
      </div>
      <a routerLink="/publicar" class="button primary"
        >Quero compartilhar <vp-icon name="Plus"
      /></a>
    </section>
    @if (demo()) {
      <p class="demo-note wrap">
        Ambiente acadêmico de demonstração: usuários e ofertas são fictícios;
        fotografias são ilustrativas.
      </p>
    }
  `,
})
export class Home implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  categories = categories;
  q = "";
  listings = signal<Listing[]>([]);
  loading = signal(true);
  error = signal("");
  demo = signal(false);
  stats = signal<{
    members: number;
    available: number;
    completed: number;
  } | null>(null);
  ngOnInit() {
    void this.load();
    this.api
      .get<{
        members: number;
        available: number;
        completed: number;
        demo?: boolean;
      }>("/stats")
      .then((s) => {
        this.stats.set(s);
        this.demo.set(s.demo ?? false);
      })
      .catch(() => {});
  }
  search() {
    void this.router.navigate(["/explorar"], { queryParams: { q: this.q } });
  }
  async load() {
    this.loading.set(true);
    this.error.set("");
    try {
      this.listings.set(
        (
          await this.api.get<Page>("/listings", {
            page_size: 6,
            sort: "nearest",
            lat: -19.94,
            lng: -44.04,
          })
        ).items,
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }
}
