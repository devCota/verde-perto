import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, Auth, Notice, errorText } from "./api";
import { Listing, categories, regions } from "./data";
import { Icon } from "./shared";
import { LocationPicker } from "./map";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, LocationPicker],
  template: ` <section class="wrap narrow page-head">
      <a routerLink="/meus-anuncios" class="back-link"
        ><vp-icon name="ArrowLeft" /> Meus anúncios</a
      >
      <h1>
        {{ id ? "Cuide da sua oferta." : "O que você vai compartilhar?" }}
      </h1>
      <p>Conte um pouco sobre o produto e combine os detalhes pelo chat.</p>
    </section>
    <section class="wrap narrow">
      @if (loading()) {
        <div class="loading" role="status">Carregando sua oferta…</div>
      } @else {
        <form class="form-card listing-form" #form="ngForm" (ngSubmit)="save()">
          <fieldset>
            <legend><span>01</span> Sua colheita</legend>
            <label
              >Nome do produto<input
                name="title"
                [(ngModel)]="data.title"
                required
                minlength="3"
                maxlength="100"
                placeholder="Ex.: Limões fresquinhos do quintal"
            /></label>
            <div class="form-row">
              <label
                >Categoria<select
                  name="category"
                  [(ngModel)]="data.category"
                  required
                >
                  @for (c of categories; track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select></label
              ><label
                >Modalidade<select
                  name="offer_type"
                  [(ngModel)]="data.offer_type"
                  required
                >
                  <option value="donation">Doação</option>
                  <option value="exchange">Troca</option>
                  <option value="sale">Venda</option>
                </select></label
              >
            </div>
            <div class="form-row">
              <label
                >Quantidade disponível<input
                  name="quantity"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                  [(ngModel)]="data.quantity" /></label
              ><label
                >Unidade<select name="unit" [(ngModel)]="data.unit">
                  @for (u of units; track u) {
                    <option [value]="u">{{ u }}</option>
                  }
                </select></label
              >
            </div>
            @if (data.offer_type === "sale") {
              <label
                >Preço por unidade de medida (R$)<input
                  name="price"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  [(ngModel)]="data.price"
                /><small
                  >O VerdePerto aproxima as pessoas. O pagamento é combinado
                  diretamente entre elas.</small
                ></label
              >
            }
            @if (data.offer_type === "exchange") {
              <label
                >O que você gostaria de receber em troca?<input
                  name="exchange_for"
                  [(ngModel)]="data.exchange_for"
                  maxlength="200"
                  placeholder="Ex.: outras mudas, sementes ou frutas"
              /></label>
            }
            <label
              >Descrição<textarea
                name="description"
                [(ngModel)]="data.description"
                required
                minlength="10"
                maxlength="3000"
                rows="4"
                placeholder="Conte sobre o cultivo, a colheita e o que a pessoa precisa saber."
              ></textarea>
            </label>
          </fieldset>
          <fieldset>
            <legend><span>02</span> Uma foto faz diferença</legend>
            <div class="upload-box">
              @if (data.image_url) {
                <img [src]="data.image_url" alt="Prévia da foto da oferta" />
              }
              <label class="upload-label"
                ><vp-icon name="ImagePlus" /><strong>{{
                  uploading()
                    ? "Preparando sua foto…"
                    : "Escolher foto do produto"
                }}</strong
                ><small>JPG, PNG ou WebP · até 5 MB</small
                ><input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  (change)="upload($event)"
                  [disabled]="uploading()"
              /></label>
            </div>
            <p class="field-help">
              A foto é opcional. Sem ela, exibiremos uma ilustração de cultivo.
            </p>
          </fieldset>
          <fieldset>
            <legend><span>03</span> Sua região, com privacidade</legend>
            <label
              >Começar por uma região<select
                name="region"
                [(ngModel)]="regionIndex"
                (change)="regionChanged()"
              >
                @for (r of regions; track r.name; let i = $index) {
                  <option [ngValue]="i">{{ r.name }}</option>
                }
              </select></label
            >
            <div class="form-row">
              <label
                >Cidade<input
                  name="city"
                  [(ngModel)]="data.city"
                  required
                  minlength="2"
                  maxlength="80" /></label
              ><label
                >Bairro<input
                  name="neighborhood"
                  [(ngModel)]="data.neighborhood"
                  required
                  minlength="2"
                  maxlength="80"
              /></label>
            </div>
            <p class="field-help">
              Clique no mapa para escolher sua região ou um ponto público
              próximo. Você também pode mover e ampliar o mapa para outras
              cidades.
            </p>
            <vp-location
              [lat]="data.public_latitude"
              [lng]="data.public_longitude"
              (location)="setLocation($event)"
            /><button class="text-link" type="button" (click)="locate()">
              <vp-icon name="LocateFixed" /> Usar minha região atual
            </button>
            <p class="privacy-note">
              <vp-icon name="ShieldCheck" /> Publicaremos apenas uma área
              aproximada. Não informe seu endereço residencial.
            </p>
          </fieldset>
          @if (id) {
            <label
              >Disponibilidade<select name="status" [(ngModel)]="data.status">
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="unavailable">Indisponível</option>
                <option value="completed">Concluído</option>
              </select></label
            >
          }
          @if (error()) {
            <div class="error" role="alert">{{ error() }}</div>
          }
          <div class="form-actions">
            <a routerLink="/meus-anuncios" class="button secondary">Cancelar</a
            ><button
              type="submit"
              class="button primary"
              [disabled]="form.invalid || busy() || uploading()"
            >
              {{
                busy()
                  ? "Salvando…"
                  : id
                    ? "Salvar alterações"
                    : "Publicar minha oferta"
              }}
              <vp-icon name="ArrowRight" />
            </button>
          </div>
        </form>
      }
    </section>`,
})
export class ListingForm implements OnInit {
  private api = inject(Api);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notice = inject(Notice);
  id = Number(this.route.snapshot.paramMap.get("id")) || null;
  categories = categories;
  regions = regions;
  regionIndex = 0;
  units = ["unidades", "kg", "g", "maços", "mudas", "pacotes", "litros"];
  data = {
    title: "",
    description: "",
    category: "fruits",
    quantity: 1,
    unit: "unidades",
    offer_type: "donation",
    price: null as number | null,
    exchange_for: "",
    image_url: null as string | null,
    city: "Contagem",
    neighborhood: "Eldorado",
    public_latitude: -19.94,
    public_longitude: -44.04,
    status: "available",
  };
  error = signal("");
  loading = signal(false);
  uploading = signal(false);
  busy = signal(false);
  async ngOnInit() {
    if (this.id) {
      this.loading.set(true);
      try {
        const l = await this.api.get<Listing>("/listings/" + this.id);
        if (l.owner_id !== this.auth.user()?.id) {
          await this.router.navigate(["/ofertas", this.id]);
          return;
        }
        for (const key of Object.keys(this.data))
          if (key in l)
            (this.data as Record<string, unknown>)[key] = (
              l as unknown as Record<string, unknown>
            )[key];
      } catch (e) {
        this.error.set(errorText(e));
      } finally {
        this.loading.set(false);
      }
    } else {
      const u = this.auth.user();
      if (u) {
        this.data.city = u.city;
        this.data.neighborhood = u.neighborhood;
      }
    }
  }
  regionChanged() {
    const r = regions[this.regionIndex];
    this.data.city = r.city;
    this.data.neighborhood = r.neighborhood;
    this.setLocation({ lat: r.lat, lng: r.lng });
  }
  setLocation(p: { lat: number; lng: number }) {
    this.data.public_latitude = p.lat;
    this.data.public_longitude = p.lng;
  }
  locate() {
    if (!navigator.geolocation) {
      this.notice.show("Escolha uma região no mapa.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        this.setLocation({
          lat: Math.round(p.coords.latitude * 100) / 100,
          lng: Math.round(p.coords.longitude * 100) / 100,
        }),
      () =>
        this.notice.show(
          "Localização não autorizada. Escolha uma região no mapa.",
        ),
      { timeout: 10000, enableHighAccuracy: false },
    );
  }
  async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.error.set("A imagem deve ter até 5 MB.");
      return;
    }
    this.uploading.set(true);
    this.error.set("");
    try {
      const form = new FormData();
      form.append("file", file);
      this.data.image_url = (
        await this.api.post<{ url: string }>("/uploads", form)
      ).url;
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.uploading.set(false);
    }
  }
  async save() {
    this.busy.set(true);
    this.error.set("");
    try {
      const body = {
        ...this.data,
        price: this.data.offer_type === "sale" ? this.data.price : null,
      };
      const l = this.id
        ? await this.api.patch<Listing>("/listings/" + this.id, body)
        : await this.api.post<Listing>("/listings", body);
      this.notice.show(
        this.id
          ? "Sua oferta foi atualizada."
          : "Sua oferta já faz parte da comunidade!",
      );
      await this.router.navigate(["/ofertas", l.id]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
