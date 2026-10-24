import { Component, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { DatePipe } from "@angular/common";
import { Api, Auth, Notice, errorText } from "./api";
import { User, Listing, Page } from "./data";
import { Card, Icon } from "./shared";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, Card, Icon],
  template: ` <section class="wrap page-head">
      <h1>{{ own ? "Meu cantinho." : "Conheça quem compartilha." }}</h1>
    </section>
    <section class="wrap profile-layout">
      @if (error()) {
        <div class="error" role="alert">{{ error() }}</div>
      }
      @if (profile(); as p) {
        <aside class="profile-summary">
          <span class="avatar large">{{ p.name.charAt(0) }}</span>
          <h2>{{ p.name }}</h2>
          <p class="location">
            <vp-icon name="MapPin" /> {{ p.neighborhood }}, {{ p.city }}
          </p>
          <p>{{ p.bio || "Faz parte da comunidade VerdePerto." }}</p>
          <small>Por aqui desde {{ p.created_at | date: "MM/yyyy" }}</small>
          @if (own) {
            <a routerLink="/meus-anuncios" class="button secondary full"
              >Gerenciar minhas ofertas</a
            >
          }
        </aside>
        <div>
          @if (own) {
            <form class="form-card" #form="ngForm" (ngSubmit)="save()">
              <h2>Sobre você</h2>
              <p>Mostre um pouco de quem está por trás da colheita.</p>
              <label
                >Nome<input
                  name="name"
                  [(ngModel)]="edit.name"
                  required
                  minlength="2"
                  maxlength="80" /></label
              ><label
                >Uma breve descrição<textarea
                  name="bio"
                  [(ngModel)]="edit.bio"
                  rows="3"
                  maxlength="500"
                ></textarea>
              </label>
              <div class="form-row">
                <label
                  >Cidade<input
                    name="city"
                    [(ngModel)]="edit.city"
                    required
                    minlength="2"
                    maxlength="80" /></label
                ><label
                  >Bairro<input
                    name="neighborhood"
                    [(ngModel)]="edit.neighborhood"
                    required
                    minlength="2"
                    maxlength="80"
                /></label>
              </div>
              <button
                class="button primary"
                [disabled]="form.invalid || busy()"
              >
                {{ busy() ? "Salvando…" : "Salvar perfil" }}
              </button>
            </form>
            <form
              class="form-card password-card"
              #passwordForm="ngForm"
              (ngSubmit)="changePassword()"
            >
              <h2>Alterar senha</h2>
              <label
                >Senha atual<input
                  name="current_password"
                  [(ngModel)]="password.current_password"
                  type="password"
                  required
                  autocomplete="current-password" /></label
              ><label
                >Nova senha<input
                  name="new_password"
                  [(ngModel)]="password.new_password"
                  type="password"
                  required
                  minlength="8"
                  maxlength="128"
                  autocomplete="new-password" /></label
              ><button
                class="button secondary"
                [disabled]="passwordForm.invalid || busy()"
              >
                Atualizar senha
              </button>
            </form>
          }
          <div class="section-heading section-space">
            <div>
              <h2>O que {{ p.name.split(" ")[0] }} compartilha.</h2>
            </div>
          </div>
          <div class="offer-grid profile-offers">
            @for (l of listings(); track l.id) {
              <vp-card [listing]="l" />
            }
          </div>
          @if (!listings().length) {
            <div class="empty">
              <vp-icon name="Sprout" />
              <p>Ainda não há ofertas publicadas.</p>
            </div>
          }
        </div>
      }
    </section>`,
})
export class Profile implements OnInit {
  api = inject(Api);
  auth = inject(Auth);
  route = inject(ActivatedRoute);
  notice = inject(Notice);
  own = !this.route.snapshot.paramMap.get("id");
  profile = signal<User | null>(null);
  listings = signal<Listing[]>([]);
  error = signal("");
  busy = signal(false);
  edit = { name: "", bio: "", city: "", neighborhood: "" };
  password = { current_password: "", new_password: "" };
  async ngOnInit() {
    try {
      const p = await this.api.get<User>(
        this.own
          ? "/users/me"
          : "/users/" + this.route.snapshot.paramMap.get("id"),
      );
      this.profile.set(p);
      this.edit = {
        name: p.name,
        bio: p.bio,
        city: p.city,
        neighborhood: p.neighborhood,
      };
      this.listings.set(
        (
          await this.api.get<Page>("/listings", {
            owner_id: p.id,
            status: "",
            page_size: 100,
          })
        ).items,
      );
    } catch (e) {
      this.error.set(errorText(e));
    }
  }
  async save() {
    this.busy.set(true);
    this.error.set("");
    try {
      const p = await this.api.patch<User>("/users/me", this.edit);
      this.profile.set(p);
      this.auth.user.set(p);
      this.notice.show("Perfil atualizado.");
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
  async changePassword() {
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.post("/users/me/password", this.password);
      this.password = { current_password: "", new_password: "" };
      this.notice.show("Senha atualizada. Outras sessões foram encerradas.");
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
