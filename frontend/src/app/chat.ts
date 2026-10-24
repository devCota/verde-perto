import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { Api, Auth, errorText } from "./api";
import { Conversation, Message } from "./data";
import { Icon } from "./shared";

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, Icon],
  template: ` <section class="wrap page-head">
      <h1>Boas conversas, boas trocas.</h1>
      <p>Combine os detalhes da retirada por aqui.</p>
    </section>
    <section class="wrap chat-layout" [class.chat-selected]="id()">
      <aside class="conversation-list">
        <h2>Suas conversas</h2>
        @if (error()) {
          <div class="error" role="alert">
            {{ error()
            }}<button class="text-link" (click)="refresh()">
              Tentar novamente
            </button>
          </div>
        }
        @for (c of conversations(); track c.id) {
          <a
            [routerLink]="['/conversas', c.id]"
            [class.selected]="id() === c.id"
            ><span class="avatar">{{ c.participant.name.charAt(0) }}</span
            ><span
              ><strong>{{ c.participant.name }}</strong
              ><small>{{ c.listing_title }}</small>
              <p>{{ c.last_message }}</p></span
            ></a
          >
        }
        @if (!loading() && !conversations().length) {
          <div class="empty">
            <vp-icon name="MessagesSquare" />
            <h3>Uma conversa pode começar por uma colheita.</h3>
            <p>Encontre uma oferta e fale com quem anunciou.</p>
            <a routerLink="/explorar" class="button secondary"
              >Explorar ofertas</a
            >
          </div>
        }
      </aside>
      <div class="chat-window">
        @if (current(); as c) {
          <header class="chat-header">
            <a
              routerLink="/conversas"
              class="icon-button mobile-only"
              aria-label="Voltar às conversas"
              ><vp-icon name="ArrowLeft" /></a
            ><span class="avatar">{{ c.participant.name.charAt(0) }}</span>
            <div>
              <strong>{{ c.participant.name }}</strong>
              @if (!c.listing_deleted) {
                <a [routerLink]="['/ofertas', c.listing_id]"
                  >{{ c.listing_title }} <vp-icon name="ArrowUpRight"
                /></a>
              } @else {
                <small>{{ c.listing_title }} · oferta removida</small>
              }
            </div>
          </header>
          <div class="chat-safety">
            <vp-icon name="ShieldCheck" /> Prefira combinar a retirada em um
            ponto público.
          </div>
          <div
            class="message-list"
            #messageList
            aria-live="polite"
            aria-relevant="additions"
          >
            @for (m of messages(); track m.id) {
              <div
                class="message"
                [class.sent]="m.sender_id === auth.user()?.id"
              >
                <p>{{ m.content }}</p>
                <time>{{ m.created_at | date: "dd/MM HH:mm" }}</time>
              </div>
            }
            @if (!messages().length) {
              <p class="empty-conversation">Diga um olá e comece a combinar.</p>
            }
          </div>
          <form class="message-form" (ngSubmit)="send()">
            <label for="message" class="sr-only">Sua mensagem</label
            ><textarea
              id="message"
              name="message"
              [(ngModel)]="text"
              rows="2"
              maxlength="2000"
              placeholder="Escreva uma mensagem…"
              required
            ></textarea
            ><button
              class="button primary"
              type="submit"
              [disabled]="!text.trim() || sending()"
              aria-label="Enviar mensagem"
            >
              <vp-icon name="Send" />
            </button>
          </form>
        } @else {
          <div class="empty chat-welcome">
            <vp-icon name="MessagesSquare" />
            <h2>Compartilhe mais que uma colheita.</h2>
            <p>Selecione uma conversa para combinar os próximos passos.</p>
          </div>
        }
      </div>
    </section>`,
})
export class Chat implements OnInit, OnDestroy {
  private api = inject(Api);
  auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private sub?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private fetching = false;
  @ViewChild("messageList") list?: ElementRef<HTMLDivElement>;
  id = signal<number | null>(null);
  current = signal<Conversation | null>(null);
  conversations = signal<Conversation[]>([]);
  messages = signal<Message[]>([]);
  error = signal("");
  loading = signal(true);
  sending = signal(false);
  text = "";
  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((p) => {
      this.id.set(Number(p.get("id")) || null);
      this.messages.set([]);
      this.current.set(null);
      this.text = "";
      void this.refresh();
    });
    this.timer = setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, 4000);
  }
  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearInterval(this.timer);
    this.id.set(null);
  }
  async refresh() {
    if (this.fetching) return;
    this.fetching = true;
    const id = this.id();
    try {
      const conversations =
        await this.api.get<Conversation[]>("/conversations");
      this.conversations.set(conversations);
      if (id) {
        const result = await this.api.get<{
          conversation: Conversation;
          items: Message[];
        }>("/conversations/" + id + "/messages", {
          after: this.messages().at(-1)?.id || 0,
        });
        if (this.id() === id) {
          this.current.set(result.conversation);
          if (result.items.length) {
            this.messages.update((items) => [
              ...items,
              ...result.items.filter((n) => !items.some((m) => m.id === n.id)),
            ]);
            setTimeout(() => this.scroll(), 0);
          }
        }
      }
      this.error.set("");
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.fetching = false;
      this.loading.set(false);
      if (this.id() !== id) void this.refresh();
    }
  }
  scroll() {
    const el = this.list?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
  async send() {
    const text = this.text.trim(),
      id = this.id();
    if (!text || !id) return;
    this.sending.set(true);
    try {
      await this.api.post("/conversations/" + id + "/messages", {
        content: text,
      });
      this.text = "";
      await this.refresh();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.sending.set(false);
    }
  }
}
