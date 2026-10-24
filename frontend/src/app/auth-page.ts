import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Auth, errorText } from "./api";
import { Icon } from "./shared";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon],
  template: ` <section class="auth-layout wrap">
    <div class="auth-story">
      <h1>Boas conexões<br />começam <span>por perto.</span></h1>
      <p>
        Entre para compartilhar uma colheita, encontrar uma muda e fazer parte
        da sua vizinhança.
      </p>
      <img src="/assets/herbs.jpg" alt="Cultivo de plantas em uma horta" />
    </div>
    <div class="form-card">
      <a routerLink="/" class="back-link"
        ><vp-icon name="ArrowLeft" /> Voltar ao início</a
      >
      <h2>
        {{
          register ? "Vamos cultivar conexões?" : "Que bom ter você por aqui."
        }}
      </h2>
      <p>
        {{
          register
            ? "Crie sua conta e comece a compartilhar."
            : "Entre na sua conta para continuar."
        }}
      </p>
      <form #form="ngForm" (ngSubmit)="submit()">
        @if (register) {
          <label
            >Seu nome<input
              name="name"
              [(ngModel)]="data.name"
              required
              minlength="2"
              maxlength="80"
              autocomplete="name"
              placeholder="Como podemos chamar você?"
          /></label>
        }
        <label
          >E-mail<input
            name="email"
            [(ngModel)]="data.email"
            type="email"
            required
            email
            autocomplete="email"
            placeholder="voce@exemplo.com"
        /></label>
        <label
          >Senha<input
            aria-label="Senha"
            name="password"
            [(ngModel)]="data.password"
            type="password"
            required
            [minlength]="register ? 8 : 1"
            maxlength="128"
            [autocomplete]="register ? 'new-password' : 'current-password'"
            placeholder="Sua senha"
          />
          @if (register) {
            <small>Use pelo menos 8 caracteres.</small>
          }
        </label>
        @if (register) {
          <div class="form-row">
            <label
              >Cidade<input
                name="city"
                [(ngModel)]="data.city"
                required
                minlength="2"
                maxlength="80"
                autocomplete="address-level2" /></label
            ><label
              >Bairro<input
                name="neighborhood"
                [(ngModel)]="data.neighborhood"
                required
                minlength="2"
                maxlength="80"
            /></label>
          </div>
          <p class="privacy-note">
            <vp-icon name="ShieldCheck" /> Só a sua região é pública. Seu
            endereço residencial não é solicitado.
          </p>
        }
        @if (error()) {
          <div class="error" role="alert">{{ error() }}</div>
        }
        <button
          class="button primary full"
          [disabled]="form.invalid || busy()"
          type="submit"
        >
          {{
            busy()
              ? "Só um instante…"
              : register
                ? "Criar minha conta"
                : "Entrar na minha conta"
          }}
          <vp-icon name="ArrowRight" />
        </button>
      </form>
      <p class="auth-switch">
        {{ register ? "Já faz parte da comunidade?" : "Ainda não tem conta?" }}
        <a
          [routerLink]="register ? '/entrar' : '/cadastro'"
          [queryParams]="{ next: next }"
          >{{ register ? "Entrar" : "Cadastre-se" }}</a
        >
      </p>
    </div>
  </section>`,
})
export class AuthPage {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  register = this.route.snapshot.url[0]?.path === "cadastro";
  next = this.route.snapshot.queryParamMap.get("next") || "/explorar";
  data = {
    name: "",
    email: "",
    password: "",
    city: "Contagem",
    neighborhood: "",
  };
  error = signal("");
  busy = signal(false);
  async submit() {
    this.busy.set(true);
    this.error.set("");
    try {
      await this.auth.login(
        this.register
          ? this.data
          : { email: this.data.email, password: this.data.password },
        this.register,
      );
      await this.router.navigateByUrl(
        this.next.startsWith("/") && !this.next.startsWith("//")
          ? this.next
          : "/explorar",
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
