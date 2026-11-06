"""Hospedagem no Linux: build local + serviços de usuário + HTTPS por túnel."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / ".local-hosting"
APP = "verdeperto.service"
TUNNEL = "verdeperto-tunnel.service"
UNITS = (
    Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "systemd/user"
)


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def systemctl(*args):
    return run(["systemctl", "--user", *args])


def quote(value):
    return (
        '"'
        + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%")
        + '"'
    )


def cloudflared():
    installed = shutil.which("cloudflared")
    if installed:
        return Path(installed)
    binary = STATE / "bin/cloudflared"
    if binary.is_file():
        return binary
    architecture = {"x86_64": "amd64", "aarch64": "arm64"}.get(platform.machine())
    if not architecture:
        raise RuntimeError(
            "Arquitetura não suportada pelo instalador. Instale cloudflared manualmente."
        )
    request = urllib.request.Request(
        "https://api.github.com/repos/cloudflare/cloudflared/releases/latest",
        headers={"User-Agent": "VerdePerto-local-hosting"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        release = json.load(response)
    asset = next(
        a for a in release["assets"] if a["name"] == f"cloudflared-linux-{architecture}"
    )
    if not asset.get("digest", "").startswith("sha256:"):
        raise RuntimeError(
            "Download oficial sem checksum SHA-256; instale cloudflared manualmente."
        )
    binary.parent.mkdir(parents=True, exist_ok=True)
    temporary = binary.with_suffix(".download")
    print(f"Baixando cloudflared oficial {release['tag_name']}…", flush=True)
    try:
        with (
            urllib.request.urlopen(
                asset["browser_download_url"], timeout=90
            ) as response,
            temporary.open("wb") as output,
        ):
            shutil.copyfileobj(response, output)
        checksum = hashlib.sha256(temporary.read_bytes()).hexdigest()
        if "sha256:" + checksum != asset["digest"]:
            raise RuntimeError("Checksum incorreto; o conector não será instalado.")
        temporary.chmod(0o755)
        temporary.replace(binary)
    finally:
        temporary.unlink(missing_ok=True)
    return binary


def build():
    python = ROOT / "backend/.venv/bin/python"
    if not python.is_file():
        run([sys.executable, "-m", "venv", ".venv"], cwd=ROOT / "backend")
        run(
            [str(python), "-m", "pip", "install", "-r", "requirements.txt"],
            cwd=ROOT / "backend",
        )
    if not (ROOT / "backend/.env").exists():
        shutil.copyfile(ROOT / "backend/.env.example", ROOT / "backend/.env")
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError(
            "Instale uma versão do Node compatível com Angular 22 e npm."
        )
    if not (ROOT / "frontend/node_modules").is_dir():
        run([npm, "ci"], cwd=ROOT / "frontend")
    run([npm, "run", "build"], cwd=ROOT / "frontend")


def install():
    binary = cloudflared()
    build()
    UNITS.mkdir(parents=True, exist_ok=True)
    (UNITS / APP).write_text(f"""[Unit]
Description=VerdePerto - frontend e API locais
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
WorkingDirectory={quote(ROOT / "backend")}
Environment=ENVIRONMENT=local-hosting
Environment={quote("FRONTEND_DIST=" + str(ROOT / "frontend/dist/verdeperto/browser"))}
ExecStart={quote(ROOT / "backend/.venv/bin/python")} -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips 127.0.0.1
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
UMask=0077

[Install]
WantedBy=default.target
""")
    (UNITS / TUNNEL).write_text(f"""[Unit]
Description=VerdePerto - acesso HTTPS pela internet
Wants={APP}
After={APP}

[Service]
ExecStart={quote(binary)} tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:8000 --metrics 127.0.0.1:20242
Restart=on-failure
RestartSec=10
TimeoutStopSec=15
UMask=0077

[Install]
WantedBy=default.target
""")
    systemctl("daemon-reload")
    systemctl("enable", APP, TUNNEL)
    start()


def current_url():
    active = subprocess.run(["systemctl", "--user", "is-active", "--quiet", TUNNEL])
    if active.returncode:
        return None
    info = subprocess.run(
        ["systemctl", "--user", "show", TUNNEL, "--property=InvocationID", "--value"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    if not info:
        return None
    result = subprocess.run(
        [
            "journalctl",
            "--user",
            "--no-pager",
            "-o",
            "cat",
            "_SYSTEMD_INVOCATION_ID=" + info,
        ],
        capture_output=True,
        text=True,
    )
    urls = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", result.stdout)
    return urls[-1] if urls else None


def start():
    if not (UNITS / APP).is_file():
        raise RuntimeError("Instale primeiro: python3 scripts/hosting.py install")
    active = subprocess.run(["systemctl", "--user", "is-active", "--quiet", APP])
    if active.returncode:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", 8000))
            except OSError:
                raise RuntimeError(
                    "A porta 8000 já está ocupada. Encerre o dev.sh ou o serviço anterior antes de hospedar."
                )
    systemctl("start", APP)
    for _ in range(60):
        try:
            with urllib.request.urlopen(
                "http://127.0.0.1:8000/api/health", timeout=1
            ) as response:
                if (
                    response.status == 200
                    and json.load(response).get("service") == "VerdePerto"
                ):
                    break
        except OSError:
            time.sleep(0.5)
    else:
        raise RuntimeError(
            "A API não iniciou. Consulte journalctl --user -u verdeperto.service -n 40"
        )
    systemctl("start", TUNNEL)
    for _ in range(60):
        url = current_url()
        if url:
            print("\nAcesso remoto: " + url)
            print(
                "O endereço muda quando o túnel é reiniciado. Computador ligado, conectado e sem suspender."
            )
            return
        time.sleep(0.5)
    raise RuntimeError(
        "Túnel ainda sem URL. Consulte journalctl --user -u verdeperto-tunnel.service -n 40"
    )


def present():
    """Apresentação temporária; Ctrl+C encerra tudo, sem instalar serviços."""
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", 8000))
        except OSError:
            raise RuntimeError("Encerre o dev.sh antes: a porta 8000 já está ocupada.")
    binary = cloudflared()
    build()
    env = {
        **os.environ,
        "ENVIRONMENT": "local-hosting",
        "FRONTEND_DIST": str(ROOT / "frontend/dist/verdeperto/browser"),
    }
    api = subprocess.Popen(
        [
            str(ROOT / "backend/.venv/bin/python"),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            "--proxy-headers",
            "--forwarded-allow-ips",
            "127.0.0.1",
        ],
        cwd=ROOT / "backend",
        env=env,
    )
    tunnel = None
    try:
        for _ in range(60):
            if api.poll() is not None:
                raise RuntimeError("A API encerrou durante a inicialização.")
            try:
                with urllib.request.urlopen(
                    "http://127.0.0.1:8000/api/health", timeout=1
                ) as response:
                    if json.load(response).get("service") == "VerdePerto":
                        break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("A API não iniciou.")
        STATE.mkdir(parents=True, exist_ok=True)
        (STATE / "presentation-url.txt").unlink(missing_ok=True)
        tunnel = subprocess.Popen(
            [
                str(binary),
                "tunnel",
                "--no-autoupdate",
                "--protocol",
                "http2",
                "--url",
                "http://127.0.0.1:8000",
                "--metrics",
                "127.0.0.1:20242",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        def forward_logs():
            with (STATE / "presentation.log").open("w") as log:
                for line in tunnel.stdout:
                    log.write(line)
                    log.flush()
                    match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
                    if match:
                        url = match.group()
                        (STATE / "presentation-url.txt").write_text(url + "\n")
                        print("\nACESSO PÚBLICO DO VERDEPERTO: " + url, flush=True)
                        print(
                            "Mantenha este processo ativo. Ctrl+C encerra a apresentação.\n",
                            flush=True,
                        )
                    elif " ERR " in line or "Registered tunnel" in line:
                        print(line.rstrip(), flush=True)

        threading.Thread(target=forward_logs, daemon=True).start()
        while True:
            if api.poll() is not None or tunnel.poll() is not None:
                raise RuntimeError(
                    "Um serviço encerrou. Consulte .local-hosting/presentation.log e inicie novamente."
                )
            time.sleep(0.5)
    finally:
        for process in (tunnel, api):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
        (STATE / "presentation-url.txt").unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=[
            "present",
            "install",
            "start",
            "stop",
            "status",
            "update",
            "uninstall",
        ],
    )
    action = parser.parse_args().action
    if sys.platform != "linux":
        raise RuntimeError(
            "Este gerenciador usa systemd de usuário e deve ser executado no Linux."
        )
    if action == "present":
        present()
    elif action == "install":
        install()
    elif action == "start":
        start()
    elif action == "stop":
        systemctl("stop", TUNNEL, APP)
    elif action == "status":
        subprocess.run(["systemctl", "--user", "--no-pager", "status", APP, TUNNEL])
        print(
            "\nAcesso remoto: " + (current_url() or "indisponível; inicie os serviços")
        )
    elif action == "update":
        build()
        systemctl("restart", APP)
        start()
    elif action == "uninstall":
        systemctl("disable", "--now", TUNNEL, APP)
        for name in (APP, TUNNEL):
            (UNITS / name).unlink(missing_ok=True)
        systemctl("daemon-reload")
        print("Serviços removidos. Banco, imagens e código foram preservados.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nApresentação encerrada.")
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print("Erro: " + str(error), file=sys.stderr)
        sys.exit(1)
