import { test, expect, Page } from "@playwright/test";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const review = resolve(process.cwd(), "../.impeccable/review");
mkdirSync(review, { recursive: true });
async function register(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("TesteVerde123!");
  await page.getByLabel("Bairro", { exact: true }).fill("Eldorado");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/explorar/);
}
async function publish(page: Page, title: string, type = "donation") {
  await page.goto("/publicar");
  await page.getByLabel("Nome do produto", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Modalidade", exact: true })
    .selectOption(type);
  if (type === "exchange")
    await page
      .getByLabel("O que você gostaria de receber em troca?")
      .fill("Mudas de hortelã");
  await page.getByLabel("Quantidade disponível", { exact: true }).fill("20");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill(
      "Colheita fictícia de teste para compartilhar no bairro. Combine a retirada na praça.",
    );
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve(process.cwd(), "public/assets/lemons.jpg"));
  await expect(page.getByAltText("Prévia da foto da oferta")).toBeVisible();
  await page.getByRole("button", { name: "Publicar minha oferta" }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

test("visitante: homepage, filtros, mapa, responsividade e erros", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Compartilhe o que a natureza oferece.",
    }),
  ).toBeVisible();
  await expect(page.locator(".offer-card").first()).toBeVisible();
  await page.screenshot({ path: review + "/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: review + "/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/explorar?category=plants");
  await expect(page.locator(".offer-card").first()).toBeVisible();
  await page.screenshot({
    path: review + "/explore-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Buscar produtos", { exact: true })
    .fill("xxxxxxxxxxxsemproduto");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma oferta por enquanto." }),
  ).toBeVisible();
  await page.goto("/mapa");
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
  await page.getByRole("button", { name: /ofertas em Eldorado/ }).click();
  await expect(
    page.locator(".map-popup").getByText("Ver oferta →").first(),
  ).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll(".leaflet-tile-loaded").length > 0,
  );
  await page.waitForTimeout(350);
  await page.screenshot({
    path: review + "/map-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".map-popup").getByText("Ver oferta →").first().click();
  await expect(page.locator(".detail-info h1")).toBeVisible();
  await page.screenshot({
    path: review + "/detail-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/listings?*", (route) => route.abort());
  await page.goto("/explorar");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível conectar",
  );
  await page.unroute("**/api/listings?*");
  await page.goto("/publicar");
  await expect(page).toHaveURL(/entrar\?next/);
});

test("jornadas de doação e troca: publicar, favoritar, conversar e concluir", async ({
  browser,
}) => {
  const suffix = Date.now();
  const contextA = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  await register(a, "Ana Teste", "ana" + suffix + "@example.com");
  await publish(a, "Limões de teste " + suffix);
  const detail = a.url();
  const id = detail.split("/").at(-1)!;
  await a.screenshot({ path: review + "/detail-desktop.png", fullPage: true });
  await register(b, "João Teste", "joao" + suffix + "@example.com");
  await b.goto(detail);
  await b.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Salvo", exact: true }),
  ).toBeVisible();
  await b.getByRole("button", { name: "Conversar com anunciante" }).click();
  await expect(
    b.getByRole("heading", { name: "Boas conversas, boas trocas." }),
  ).toBeVisible();
  await b
    .getByLabel("Sua mensagem", { exact: true })
    .fill("Posso retirar oito limões na praça às 15h?");
  await b.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    b
      .locator(".message")
      .getByText("Posso retirar oito limões na praça às 15h?"),
  ).toBeVisible();
  await a.goto("/conversas");
  await a.locator(".conversation-list>a").first().click();
  await expect(
    a
      .locator(".message")
      .getByText("Posso retirar oito limões na praça às 15h?"),
  ).toBeVisible();
  await a
    .getByLabel("Sua mensagem", { exact: true })
    .fill("Combinado! Até às 15h.");
  await a.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    b.locator(".message").getByText("Combinado! Até às 15h."),
  ).toBeVisible({ timeout: 12000 });
  await b.screenshot({ path: review + "/chat-mobile.png", fullPage: true });
  await a.screenshot({ path: review + "/chat-desktop.png", fullPage: true });
  await a.goto("/meus-anuncios");
  let item = a
    .locator(".manage-item")
    .filter({ hasText: "Limões de teste " + suffix });
  await item.getByLabel("Quantidade", { exact: true }).fill("12");
  await item.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(a.getByRole("status")).toContainText(
    "Disponibilidade atualizada",
  );
  await item.getByLabel("Quantidade", { exact: true }).fill("0");
  await item.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(item.locator(".manage-copy")).toContainText("Concluído");
  await publish(a, "Mudas de teste " + suffix, "exchange");
  const exchange = a.url();
  await b.goto("/explorar?category=fruits");
  await b
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("fruits");
  await b.goto(exchange);
  await b.getByRole("button", { name: "Salvar", exact: true }).click();
  await b.getByRole("button", { name: "Conversar com anunciante" }).click();
  await b
    .getByLabel("Sua mensagem", { exact: true })
    .fill("Troco pelas minhas mudas de hortelã.");
  await b.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    b.locator(".message").getByText("Troco pelas minhas mudas de hortelã."),
  ).toBeVisible();
  await b.goto("/favoritos");
  await expect(
    b.locator(".offer-card").filter({ hasText: "Mudas de teste " + suffix }),
  ).toBeVisible();
  await a.goto("/ofertas/" + id + "/editar");
  await expect(a.getByLabel("Nome do produto")).toHaveValue(
    "Limões de teste " + suffix,
  );
  await a.screenshot({ path: review + "/form-desktop.png", fullPage: true });
  await a.goto("/perfil");
  await a
    .getByLabel("Uma breve descrição")
    .fill("Testando a comunidade de cultivo.");
  await a.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(a.getByRole("status")).toContainText("Perfil atualizado");
  await a.reload();
  await expect(a.getByLabel("Uma breve descrição")).toHaveValue(
    "Testando a comunidade de cultivo.",
  );
  await a.goto("/meus-anuncios");
  a.on("dialog", (d) => d.accept());
  await a
    .locator(".manage-item")
    .filter({ hasText: "Limões de teste " + suffix })
    .getByRole("button", { name: "Excluir oferta" })
    .click();
  await expect(
    a.locator(".manage-item").filter({ hasText: "Limões de teste " + suffix }),
  ).toHaveCount(0);
  await a
    .locator(".manage-item")
    .filter({ hasText: "Mudas de teste " + suffix })
    .getByRole("button", { name: "Excluir oferta" })
    .click();
  await expect(
    a.locator(".manage-item").filter({ hasText: "Mudas de teste " + suffix }),
  ).toHaveCount(0);
  await contextA.close();
  await contextB.close();
});

test("login de demonstração e sessão recuperada após recarregar", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("ana@verdeperto.example");
  await page.getByLabel("Senha", { exact: true }).fill("DemoVerde123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/explorar/);
  await page.reload();
  await page.getByRole("button", { name: "Abrir menu da conta" }).click();
  await expect(
    page.getByRole("link", { name: "Meu perfil", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
});
