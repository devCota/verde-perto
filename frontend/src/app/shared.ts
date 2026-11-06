import { Component, Input, ElementRef, inject, OnChanges } from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  createElement,
  Leaf,
  Search,
  MapPin,
  Map,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Sprout,
  Heart,
  HeartOff,
  HeartHandshake,
  Plus,
  PlusCircle,
  LayoutGrid,
  LocateFixed,
  Apple,
  Carrot,
  Salad,
  Flower2,
  Bean,
  ShieldCheck,
  ImagePlus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  MessagesSquare,
  Send,
  UserRound,
  ChevronDown,
  CheckCircle2,
  X,
} from "lucide";
import { Listing, offerNames, statusNames } from "./data";

@Component({
  selector: "vp-icon",
  standalone: true,
  template: "",
  host: { "aria-hidden": "true" },
})
export class Icon implements OnChanges {
  @Input() name = "Leaf";
  private el = inject(ElementRef<HTMLElement>);
  ngOnChanges() {
    const icons = {
      Leaf,
      Search,
      MapPin,
      Map,
      ArrowRight,
      ArrowLeft,
      ArrowUpRight,
      Sprout,
      Heart,
      HeartOff,
      HeartHandshake,
      Plus,
      PlusCircle,
      LayoutGrid,
      LocateFixed,
      Apple,
      Carrot,
      Salad,
      Flower2,
      Bean,
      ShieldCheck,
      ImagePlus,
      Pencil,
      Trash2,
      ArrowLeftRight,
      MessagesSquare,
      Send,
      UserRound,
      ChevronDown,
      CheckCircle2,
      X,
    };
    const key = this.name
      .replace(/(^|-)([a-z])/g, (_, __, letter: string) => letter.toUpperCase())
      .replace(/-([0-9])/g, "$1") as keyof typeof icons;
    const node = createElement(icons[key] || Leaf);
    node.setAttribute("width", "20");
    node.setAttribute("height", "20");
    node.setAttribute("stroke-width", "1.7");
    this.el.nativeElement.replaceChildren(node);
  }
}
@Component({
  selector: "vp-card",
  standalone: true,
  imports: [RouterLink, Icon],
  template: ` <a class="offer-card" [routerLink]="['/ofertas', listing.id]">
    <div class="offer-photo">
      <img
        [src]="listing.image_url || 'assets/product-default.svg'"
        [alt]="listing.title"
        loading="lazy"
        (error)="imageFallback($event)"
      /><span class="tag" [class]="'tag ' + listing.offer_type">{{
        offers[listing.offer_type]
      }}</span>
      @if (listing.status !== "available") {
        <span class="status-photo">{{ statuses[listing.status] }}</span>
      }
    </div>
    <div class="offer-content">
      <div class="offer-meta">
        <span>{{ listing.quantity }} {{ listing.unit }}</span>
        @if (listing.price) {
          <strong>{{ money(listing.price) }}</strong>
        } @else {
          <span>{{
            listing.offer_type === "exchange"
              ? "Vamos trocar?"
              : "Para compartilhar"
          }}</span>
        }
      </div>
      <h3>{{ listing.title }}</h3>
      <p class="location">
        <vp-icon name="MapPin" /> {{ listing.neighborhood }}, {{ listing.city }}
      </p>
      <div class="offer-person">
        <span class="avatar small">{{ listing.owner.name.charAt(0) }}</span
        ><span>{{ listing.owner.name.split(" ")[0] }}</span
        ><span class="distance"
          >{{
            listing.distance_km !== null
              ? "≈ " + listing.distance_km + " km"
              : "Ver oferta"
          }}
          <vp-icon name="ArrowUpRight"
        /></span>
      </div>
    </div>
  </a>`,
})
export class Card {
  @Input({ required: true }) listing!: Listing;
  offers = offerNames;
  statuses = statusNames;
  money(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  imageFallback(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = "assets/product-default.svg";
  }
}
