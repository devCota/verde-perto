import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";
import * as L from "leaflet";
import { Listing, offerNames } from "./data";

@Component({
  selector: "vp-map",
  standalone: true,
  template: `<div
      #canvas
      class="map-canvas"
      aria-label="Mapa de ofertas com localizações aproximadas"
    ></div>
    <p class="map-disclaimer">
      Os marcadores indicam regiões aproximadas. Nunca endereços residenciais.
    </p>`,
})
export class OfferMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() listings: Listing[] = [];
  @Input() lat = -19.94;
  @Input() lng = -44.04;
  @ViewChild("canvas", { static: true }) canvas!: ElementRef<HTMLDivElement>;
  private router = inject(Router);
  private map?: L.Map;
  private markers?: L.LayerGroup;
  ngAfterViewInit() {
    this.map = L.map(this.canvas.nativeElement).setView(
      [this.lat, this.lng],
      13,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
    this.render();
  }
  ngOnChanges() {
    this.render();
  }
  private render() {
    if (!this.map || !this.markers) return;
    this.map.setView([this.lat, this.lng], this.map.getZoom());
    this.markers.clearLayers();
    const groups = new Map<string, Listing[]>();
    for (const listing of this.listings) {
      const key = `${listing.public_latitude},${listing.public_longitude}`;
      groups.set(key, [...(groups.get(key) || []), listing]);
    }
    for (const listings of groups.values()) {
      const first = listings[0];
      const popup = document.createElement("div");
      popup.className = "map-popup";
      for (const listing of listings) {
        const item = document.createElement("div");
        item.className = "map-popup-item";
        const type = document.createElement("span");
        type.textContent = offerNames[listing.offer_type];
        type.className = "tag " + listing.offer_type;
        const title = document.createElement("strong");
        title.textContent = listing.title;
        const region = document.createElement("p");
        region.textContent = `${listing.neighborhood} · ${listing.quantity} ${listing.unit}`;
        const link = document.createElement("a");
        link.href = "/ofertas/" + listing.id;
        link.textContent = "Ver oferta →";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          void this.router.navigate(["/ofertas", listing.id]);
        });
        item.append(type, title, region, link);
        popup.append(item);
      }
      const multiple = listings.length > 1;
      const text = multiple
        ? String(listings.length)
        : first.offer_type === "donation"
          ? "♡"
          : first.offer_type === "exchange"
            ? "⇄"
            : "R$";
      L.marker([first.public_latitude, first.public_longitude], {
        title: multiple
          ? `${listings.length} ofertas em ${first.neighborhood}`
          : first.title,
        icon: L.divIcon({
          className:
            "offer-marker " + (multiple ? "donation" : first.offer_type),
          html: '<span aria-hidden="true">' + text + "</span>",
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        }),
      })
        .addTo(this.markers)
        .bindPopup(popup);
    }
  }
  ngOnDestroy() {
    this.map?.remove();
  }
}

@Component({
  selector: "vp-location",
  standalone: true,
  template: `<div
    #canvas
    class="map-canvas small-map"
    aria-label="Escolha a região aproximada da oferta no mapa"
  ></div>`,
})
export class LocationPicker implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat = -19.94;
  @Input() lng = -44.04;
  @Output() location = new EventEmitter<{ lat: number; lng: number }>();
  @ViewChild("canvas", { static: true }) canvas!: ElementRef<HTMLDivElement>;
  private map?: L.Map;
  private circle?: L.Circle;
  ngAfterViewInit() {
    this.map = L.map(this.canvas.nativeElement).setView(
      [this.lat, this.lng],
      13,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 16,
      attribution: "&copy; OpenStreetMap",
    }).addTo(this.map);
    this.map.on("click", (e: L.LeafletMouseEvent) =>
      this.location.emit({
        lat: Math.round(e.latlng.lat * 100) / 100,
        lng: Math.round(e.latlng.lng * 100) / 100,
      }),
    );
    this.render();
  }
  ngOnChanges() {
    this.render();
  }
  render() {
    if (!this.map) return;
    this.map.setView([this.lat, this.lng]);
    this.circle?.remove();
    this.circle = L.circle([this.lat, this.lng], {
      radius: 750,
      color: "#237A57",
      fillOpacity: 0.15,
    }).addTo(this.map);
  }
  ngOnDestroy() {
    this.map?.remove();
  }
}
