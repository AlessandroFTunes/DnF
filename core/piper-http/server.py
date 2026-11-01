#!/usr/bin/env python3
"""
Ponte HTTP para o Piper do NAS (`rpg-piper`, protocolo Wyoming via TCP), que o PocketBase não consegue chamar
direto. É a voz do Grande Sábio: `core/pb_hooks/tts/piper.js` chama `GET /tts?text=...` e recebe o mesmo
formato do `/tts` do app: { audio (wav em base64), format: "wav", starts (s), duration (s) }.

Só biblioteca padrão. Ambiente: PIPER_HOST e PIPER_PORT (padrão rpg-piper:10200) e PORT (padrão 5100).
O Piper não informa o tempo de cada letra: `starts` espalha a duração pelo texto, com pausa na pontuação.
"""
import base64
import io
import json
import os
import socket
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PIPER_HOST = os.environ.get("PIPER_HOST", "rpg-piper")
PIPER_PORT = int(os.environ.get("PIPER_PORT", "10200"))
PORT = int(os.environ.get("PORT", "5100"))
# Voz fixa do Grande Sábio (uma das vozes instaladas no rpg-piper).
VOICE = "pt_BR-cadu-medium"
MAX_TEXT = 600
PUNCTUATION = set(".,;:!?…")


def read_event(stream):
    """Um evento Wyoming: linha JSON de cabeçalho, depois `data` (JSON) e `payload` (bytes), se houver."""
    line = stream.readline()
    if not line:
        raise ConnectionError("o Piper fechou a conexão")
    header = json.loads(line)
    data = header.get("data") or {}
    if header.get("data_length"):
        data = {**data, **json.loads(stream.read(header["data_length"]))}
    payload = stream.read(header["payload_length"]) if header.get("payload_length") else b""
    return header["type"], data, payload


def synthesize(text):
    """Texto → (wav em bytes, duração em segundos)."""
    with socket.create_connection((PIPER_HOST, PIPER_PORT), timeout=30) as sock:
        event = {"type": "synthesize", "data": {"text": text, "voice": {"name": VOICE}}}
        sock.sendall((json.dumps(event) + "\n").encode())
        stream = sock.makefile("rb")
        fmt, pcm = None, bytearray()
        while True:
            kind, data, payload = read_event(stream)
            if kind == "audio-start":
                fmt = data
            elif kind == "audio-chunk":
                fmt = fmt or data
                pcm += payload
            elif kind == "audio-stop":
                break
            elif kind == "error":
                raise RuntimeError(data.get("text", "erro do Piper"))
    if not fmt or not pcm:
        raise RuntimeError("o Piper não devolveu áudio")
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(fmt["channels"])
        wav.setsampwidth(fmt["width"])
        wav.setframerate(fmt["rate"])
        wav.writeframes(pcm)
    return out.getvalue(), len(pcm) / (fmt["rate"] * fmt["width"] * fmt["channels"])


def estimated_starts(text, duration):
    """Início estimado de cada letra (s). Conta em UTF-16, como o `indexOf` do app."""
    weights = []
    for ch in text:
        weights += [5 if ch in PUNCTUATION else 1] * (2 if ord(ch) > 0xFFFF else 1)
    total = sum(weights) or 1
    starts, acc = [], 0
    for w in weights:
        starts.append(acc / total * duration)
        acc += w
    return starts


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/health":
            return self.reply(200, {"ok": True})
        if url.path != "/tts":
            return self.reply(404, {"message": "Use GET /tts?text=..."})
        text = (parse_qs(url.query).get("text") or [""])[0].strip()
        if not text or len(text) > MAX_TEXT:
            return self.reply(400, {"message": f"Texto vazio ou maior que {MAX_TEXT} caracteres."})
        try:
            audio, duration = synthesize(text)
        except Exception as error:  # Piper fora do ar, voz inexistente…
            return self.reply(502, {"message": f"Piper: {error}"})
        self.reply(200, {
            "audio": base64.b64encode(audio).decode(),
            "format": "wav",
            "starts": estimated_starts(text, duration),
            "duration": duration,
        })

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
