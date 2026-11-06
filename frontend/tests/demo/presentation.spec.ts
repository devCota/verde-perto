import { test, expect, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const requests = new WeakMap<Page, string[]>();
const review = resolve("../.impeccable/review/demo");
mkdirSync(review, { recursive: true });
const go = (page: Page, route = "/") => page.goto("./#" + route);
async function login(page: Page, name = "Ana") {
  await go(page, "/entrar");
  await page.getByRole("button", { name: "Entrar como " + name, exact: true }).click();
  await expect(page).toHaveURL(/#\/explorar$/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Abrir menu da conta" }).click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
}
async function publish(page: Page, title: string, type = "donation", upload = false) {
  await go(page, "/publicar");
  await page.getByLabel("Nome do produto", { exact: true }).fill(title);
  await page.getByLabel("Descrição", { exact: true }).fill("Colheita fictícia de teste, com retirada combinada na praça do bairro.");
  await page.getByLabel("Quantidade disponível", { exact: true }).fill("12");
  await page.getByRole("combobox", { name: "Modalidade", exact: true }).selectOption(type);
  if (type === "sale") await page.getByLabel("Preço por unidade de medida (R$)").fill("5.50");
  if (type === "exchange") await page.getByLabel("O que você gostaria de receber em troca?").fill("Sementes de flores");
  if (upload) {
    await page.locator("input[type=file]").setInputFiles(resolve("public/assets/lemons.jpg"));
    await expect(page.getByAltText("Prévia da foto da oferta")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  }
  await page.getByRole("button", { name: "Publicar minha oferta", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const api: string[] = [];
  requests.set(page, api);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/api/")) api.push(request.url());
  });
  await page.route("**/api/**", (route) => route.abort());
  // O fundo do mapa é externo; marcadores, filtros e links não dependem dele.
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});
test.afterEach(async ({ page }) => {
  expect(requests.get(page), "A demonstração não deve fazer chamadas à API").toEqual([]);
});

test("visita em subdiretório estático: imagens, busca, filtros, mapa e links diretos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go(page);
  await expect(page.getByRole("heading", { name: "Compartilhe o que a natureza oferece." })).toBeVisible();
  await expect(page.locator(".offer-card")).toHaveCount(6);
  await expect(page.getByRole("complementary", { name: "Demonstração do VerdePerto" })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.decode()));
  });
  expect(await page.locator("img").evaluateAll((images) => images.every((i) => i.naturalWidth > 0))).toBeTruthy();
  await page.screenshot({ path: review + "/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: review + "/mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await go(page, "/explorar?category=plants");
  await expect(page.locator(".offer-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await page.getByLabel("Buscar produtos", { exact: true }).fill("limoes");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".offer-card")).toHaveCount(1);
  await page.getByLabel("Buscar produtos", { exact: true }).fill("nenhum-produto-assim");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nenhuma oferta por enquanto." })).toBeVisible();
  await go(page, "/mapa");
  await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible();
  await page.getByRole("button", { name: /ofertas em Eldorado/ }).click();
  const link = page.locator(".map-popup a").first();
  expect(await link.evaluate((a: HTMLAnchorElement) => a.href)).toMatch(/\/verde-perto\/#\/ofertas\/\d+$/);
  await link.click();
  await expect(page.locator(".detail-info h1")).toBeVisible();
  await page.reload();
  await expect(page.locator(".detail-info h1")).toBeVisible();
  await go(page, "/caminho-inexistente");
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page.locator(".hero")).toBeVisible();
  await page.getByRole("link", { name: "Pular para o conteúdo" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page).not.toHaveURL(/#main$/);
});

test("contas prontas, validação de login, perfil, senha e sessão após recarregar", async ({ page }) => {
  await go(page, "/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@verdeperto.example");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaErrada!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: review + "/contas-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Entrar como Ana", exact: true }).click();
  await expect(page).toHaveURL(/#\/explorar$/);
  await go(page, "/perfil");
  await page.getByLabel("Nome", { exact: true }).fill("Ana da Horta");
  await page.getByLabel("Uma breve descrição").fill("Perfil atualizado para a apresentação.");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Perfil atualizado");
  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ana da Horta");
  await page.getByLabel("Senha atual", { exact: true }).fill("DemoVerde123!");
  await page.getByLabel("Nova senha", { exact: true }).fill("OutraSenhaDemo123!");
  await page.getByRole("button", { name: "Atualizar senha", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Senha da conta de teste atualizada");
  await logout(page);
  await go(page, "/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@verdeperto.example");
  await page.getByLabel("Senha", { exact: true }).fill("OutraSenhaDemo123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page).toHaveURL(/#\/explorar$/);
});

test("cadastro, publicação com foto, edição, disponibilidade e exclusão persistentes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, "/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa de Teste");
  await page.getByLabel("E-mail", { exact: true }).fill("pessoa@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("TesteVerde123!");
  await page.getByLabel("Bairro", { exact: true }).fill("Eldorado");
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await expect(page).toHaveURL(/#\/explorar$/);
  await publish(page, "Colheita para apresentação", "sale", true);
  const detailUrl = page.url();
  await page.reload();
  await expect(page.locator(".detail-photo img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  await page.getByRole("link", { name: "Editar minha oferta", exact: true }).click();
  await expect(page.getByLabel("Nome do produto", { exact: true })).toHaveValue("Colheita para apresentação");
  await page.getByLabel("Nome do produto", { exact: true }).fill("Colheita atualizada");
  await page.getByRole("combobox", { name: "Modalidade", exact: true }).selectOption("exchange");
  await page.getByLabel("O que você gostaria de receber em troca?").fill("Mudas de hortelã");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Colheita atualizada", exact: true })).toBeVisible();
  await page.screenshot({ path: review + "/oferta-mobile.png", fullPage: true });
  await go(page, "/meus-anuncios");
  let item = page.locator(".manage-item").filter({ hasText: "Colheita atualizada" });
  await item.getByLabel("Quantidade", { exact: true }).fill("0");
  await item.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(item.locator(".manage-copy")).toContainText("Concluído");
  await page.reload();
  await expect(item.getByLabel("Quantidade", { exact: true })).toHaveValue("0");
  page.on("dialog", (dialog) => dialog.accept());
  await item.getByRole("button", { name: "Excluir oferta", exact: true }).click();
  await expect(item).toHaveCount(0);
  await page.goto(detailUrl);
  await expect(page.getByRole("alert")).toHaveText("Oferta não encontrada.");
});

test("favoritos, chat simulado, troca de conta e histórico de oferta removida", async ({ page }) => {
  await login(page);
  await go(page, "/ofertas/2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvo", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Salvo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Conversar com anunciante", exact: true }).click();
  await page.getByLabel("Sua mensagem", { exact: true }).fill("Posso trocar por sementes?");
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
  await expect(page.locator(".message").getByText("Posso trocar por sementes?", { exact: true })).toBeVisible();
  await expect(page.getByText("Resposta simulada", { exact: true })).toBeVisible();
  const chatUrl = page.url();
  await page.reload();
  await expect(page.locator(".message").getByText("Posso trocar por sementes?", { exact: true })).toBeVisible();
  await page.screenshot({ path: review + "/chat-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: review + "/chat-mobile.png", fullPage: true });
  await go(page, "/ofertas/2");
  await page.getByRole("button", { name: "Conversar com anunciante", exact: true }).click();
  await expect(page).toHaveURL(chatUrl);
  await go(page, "/favoritos");
  await expect(page.locator(".offer-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Remover dos favoritos", exact: true }).click();
  await expect(page.locator(".offer-card")).toHaveCount(0);
  await login(page, "João");
  await go(page, "/meus-anuncios");
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator(".manage-item").filter({ hasText: "Mudas de manjericão" })
    .getByRole("button", { name: "Excluir oferta", exact: true }).click();
  await page.goto(chatUrl);
  await expect(page.locator(".chat-header")).toContainText("oferta removida");
  await expect(page.locator(".message").getByText("Posso trocar por sementes?", { exact: true })).toBeVisible();
});

test("proteções de navegação e dados isolados entre navegadores", async ({ page, browser }) => {
  await go(page, "/publicar");
  await expect(page).toHaveURL(/#\/entrar\?next/);
  await page.getByRole("button", { name: "Entrar como João", exact: true }).click();
  await expect(page).toHaveURL(/#\/publicar$/);
  await go(page, "/ofertas/1/editar");
  await expect(page).toHaveURL(/#\/ofertas\/1$/);
  await expect(page.getByRole("link", { name: "Editar minha oferta", exact: true })).toHaveCount(0);
  await publish(page, "Oferta privada deste navegador");
  const another = await browser.newContext();
  const other = await another.newPage();
  await other.goto("http://127.0.0.1:4300/verde-perto/#/explorar?q=Oferta%20privada");
  await expect(other.getByRole("heading", { name: "Nenhuma oferta por enquanto." })).toBeVisible();
  await another.close();
  await go(page, "/conversas/9999");
  await expect(page.getByRole("alert")).toContainText("Conversa não encontrada");
});

test("restaurar demonstração apaga apenas os dados deste projeto e encerra a sessão", async ({ page }) => {
  await login(page);
  await publish(page, "Oferta que será restaurada");
  await page.evaluate(() => localStorage.setItem("outro-projeto", "preservar"));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Recomeçar demonstração", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Oferta que será restaurada", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Recomeçar demonstração", exact: true }).click();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.locator(".offer-card")).toHaveCount(6);
  expect(await page.evaluate(() => localStorage.getItem("outro-projeto"))).toBe("preservar");
  await go(page, "/explorar?q=Oferta%20que%20será%20restaurada");
  await expect(page.locator(".offer-card")).toHaveCount(0);
  await login(page);
});

test("falha de armazenamento não confirma uma alteração que não foi salva", async ({ page }) => {
  await login(page);
  await go(page, "/perfil");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ana Oliveira");
  await page.evaluate(() => {
    Storage.prototype.setItem = function () { throw new DOMException("Quota cheia", "QuotaExceededError"); };
  });
  await page.getByLabel("Nome", { exact: true }).fill("Nome sem espaço para salvar");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Seus dados anteriores foram preservados");
  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ana Oliveira");
});
