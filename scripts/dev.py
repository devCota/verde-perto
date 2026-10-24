"""Inicializador multiplataforma. Chamado por dev.sh e dev.ps1."""

import hashlib
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import socket

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
processes = []


def run(args, cwd):
    subprocess.run(args, cwd=cwd, check=True)


def free_port(port):
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            raise RuntimeError(
                f"A porta {port} já está em uso. Encerre o serviço anterior e tente novamente."
            )


def main():
    print("[1/4] Verificando Python e Node.js…", flush=True)
    if sys.version_info < (3, 11):
        raise RuntimeError("Instale Python 3.11 ou superior.")
    npm = shutil.which("npm")
    if not npm or not shutil.which("node"):
        raise RuntimeError("Instale Node.js 22.22.3+, 24.15+ ou 26+ e npm.")
    node_major = int(
        subprocess.check_output(
            ["node", "-p", "process.versions.node.split('.')[0]"], text=True
        ).strip()
    )
    if node_major not in (22, 24, 26):
        raise RuntimeError(
            "Use uma versão suportada pelo Angular 22: Node 22.22.3+, 24.15+ ou 26+."
        )
    python = (
        BACKEND / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    print("[2/4] Preparando o ambiente Python…", flush=True)
    if not python.exists():
        run([sys.executable, "-m", "venv", ".venv"], BACKEND)
    requirements = hashlib.sha256(
        (BACKEND / "requirements.txt").read_bytes()
    ).hexdigest()
    marker = BACKEND / ".venv" / ".requirements-hash"
    if not marker.exists() or marker.read_text() != requirements:
        run([str(python), "-m", "pip", "install", "-r", "requirements.txt"], BACKEND)
        marker.write_text(requirements)
    if not (BACKEND / ".env").exists():
        shutil.copyfile(BACKEND / ".env.example", BACKEND / ".env")
    if "--seed" in sys.argv:
        print("Preparando os dados de demonstração…", flush=True)
        run([str(python), "-m", "app.seed"], BACKEND)
        return
    print("[3/4] Conferindo as dependências do Angular…", flush=True)
    dependency_hash = hashlib.sha256(
        (FRONTEND / "package-lock.json").read_bytes()
    ).hexdigest()
    frontend_marker = FRONTEND / "node_modules" / ".dependencies-hash"
    if not frontend_marker.exists() or frontend_marker.read_text() != dependency_hash:
        run([npm, "ci"], FRONTEND)
        frontend_marker.write_text(dependency_hash)
    for port in (8000, 4200):
        free_port(port)
    print("[4/4] Iniciando a API; em seguida, o Angular…", flush=True)
    processes.append(
        subprocess.Popen(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=BACKEND,
        )
    )
    for _ in range(100):
        if processes[0].poll() is not None:
            raise RuntimeError(
                "A API encerrou durante a inicialização; consulte o erro acima."
            )
        try:
            with urllib.request.urlopen(
                "http://127.0.0.1:8000/api/health", timeout=1
            ) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(0.2)
    else:
        raise RuntimeError("A API não iniciou na porta 8000.")
    processes.append(
        subprocess.Popen(
            [npm, "start"],
            cwd=FRONTEND,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
            start_new_session=os.name != "nt",
        )
    )
    print(
        "\nVerdePerto iniciando\nFrontend: http://localhost:4200\nAPI: http://localhost:8000/api/health\nSwagger: http://localhost:8000/docs\nCtrl+C encerra os serviços.\n",
        flush=True,
    )
    while True:
        for process in processes:
            if process.poll() is not None:
                raise RuntimeError(
                    f"Um serviço encerrou (código {process.returncode}). Consulte o erro acima."
                )
        time.sleep(0.5)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nEncerrando VerdePerto…")
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"\nErro: {exc}", file=sys.stderr)
        sys.exitcode = 1
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True,
                    )
                elif process is processes[-1] and len(processes) > 1:
                    os.killpg(process.pid, signal.SIGTERM)
                else:
                    process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
    sys.exit(getattr(sys, "exitcode", 0))
