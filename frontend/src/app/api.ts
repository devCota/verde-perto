import { inject, Injectable, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Router, CanActivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { User } from "./data";

@Injectable({ providedIn: "root" })
export class Api {
  http = inject(HttpClient);
  get<T>(path: string, params: Record<string, string | number> = {}) {
    return firstValueFrom(this.http.get<T>("/api" + path, { params }));
  }
  post<T>(path: string, body: unknown = {}) {
    return firstValueFrom(this.http.post<T>("/api" + path, body));
  }
  patch<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>("/api" + path, body));
  }
  delete(path: string) {
    return firstValueFrom(this.http.delete("/api" + path));
  }
}
export function errorText(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    const detail = error.error?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
      return detail
        .map((e: { msg: string; loc: string[] }) => `${e.loc.at(-1)}: ${e.msg}`)
        .join(" · ");
  }
  return "Não foi possível concluir esta ação. Tente novamente.";
}
@Injectable({ providedIn: "root" })
export class Notice {
  text = signal("");
  private timeout?: ReturnType<typeof setTimeout>;
  show(value: string) {
    this.text.set(value);
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.text.set(""), 5000);
  }
}
@Injectable({ providedIn: "root" })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  user = signal<User | null>(null);
  ready = this.restore();
  async restore() {
    try {
      this.user.set(await this.api.get<User>("/auth/me"));
    } catch {
      this.user.set(null);
    }
  }
  async login(body: unknown, register = false) {
    this.user.set(
      await this.api.post<User>(
        register ? "/auth/register" : "/auth/login",
        body,
      ),
    );
  }
  async logout() {
    await this.api.post("/auth/logout");
    this.user.set(null);
    await this.router.navigateByUrl("/");
  }
}
export const authGuard: CanActivateFn = async (_, state) => {
  const auth = inject(Auth),
    router = inject(Router);
  await auth.ready;
  return auth.user()
    ? true
    : router.createUrlTree(["/entrar"], { queryParams: { next: state.url } });
};
