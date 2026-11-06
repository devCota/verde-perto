"""Frontend compilado e API na mesma origem, para hospedagem no próprio PC."""

from pathlib import Path, PurePosixPath

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class FrontendFiles(StaticFiles):
    async def get_response(self, path, scope):
        # Nunca transforme API inexistente, arquivos privados ou assets ausentes
        # em index.html. StaticFiles também impede travessia de diretórios.
        parts = PurePosixPath(path).parts
        if parts and (
            parts[0] in {"api", "docs", "redoc", "openapi.json"}
            or any(part.startswith(".") for part in parts)
        ):
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or PurePosixPath(path).suffix:
                raise
            # Rotas Angular precisam funcionar também quando abertas por link.
            return await super().get_response("index.html", scope)


def mount_frontend(app: FastAPI, directory: str):
    root = Path(directory).resolve()
    if not (root / "index.html").is_file():
        raise RuntimeError(
            "Frontend não compilado. Execute npm run build em frontend/."
        )
    app.mount("/", FrontendFiles(directory=root, html=True), name="frontend")
