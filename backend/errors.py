"""One error shape for every endpoint: {"error": {"code": ..., "message": ...}}"""

from fastapi.responses import JSONResponse


class ApiError(Exception):
    """Raise this anywhere in a request. main.py turns it into the error response."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})
