"""In-memory sliding-window rate limiting for authentication endpoints (SEC-F02).

State is per process: the production image runs a single uvicorn worker. If the
app is ever scaled to several workers/replicas, move the store to a shared backend.
"""
import ipaddress
import math
import threading
import time
from collections import deque
from typing import Dict, Deque, Mapping, Optional, List

from fastapi import HTTPException, Request, status

from app.core.config import settings

WINDOW_SECONDS = 60
_MAX_TRACKED_KEYS = 10_000


class SlidingWindowLimiter:
    def __init__(self, window_seconds: int = WINDOW_SECONDS) -> None:
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _now(self) -> float:
        return time.monotonic()

    def hit(self, key: str, limit: int) -> Optional[int]:
        """Register one attempt. Returns None if allowed, else seconds until retry."""
        now = self._now()
        with self._lock:
            if len(self._hits) > _MAX_TRACKED_KEYS:
                self._purge(now)
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= limit:
                return max(1, math.ceil(self.window - (now - q[0])))
            q.append(now)
            return None

    def _purge(self, now: float) -> None:
        for k in [k for k, q in self._hits.items() if not q or now - q[-1] >= self.window]:
            del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = SlidingWindowLimiter()


def _parse_networks(raw: str) -> List[ipaddress._BaseNetwork]:
    nets = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            nets.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            continue  # ignore malformed entries: fail closed (untrusted)
    return nets


def _valid_ip(value: str) -> Optional[ipaddress._BaseAddress]:
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def resolve_client_ip(peer: str, headers: Mapping[str, str], trusted_proxies: str) -> str:
    """Real client IP. Forwarded headers are honored ONLY if the direct peer is a trusted proxy."""
    nets = _parse_networks(trusted_proxies)
    peer_ip = _valid_ip(peer)
    is_trusted = lambda ip: any(ip in n for n in nets)  # noqa: E731
    if peer_ip is None or not is_trusted(peer_ip):
        return peer

    headers = {k.lower(): v for k, v in headers.items()}
    cf = headers.get("cf-connecting-ip")
    if cf and (ip := _valid_ip(cf)) is not None:
        return str(ip)

    xff = headers.get("x-forwarded-for")
    if xff:
        # Walk right-to-left, skipping our own trusted proxies; first other hop is the client.
        for hop in reversed([h for h in xff.split(",") if h.strip()]):
            ip = _valid_ip(hop)
            if ip is None:
                break
            if not is_trusted(ip):
                return str(ip)
    return peer


def _enforce(scope: str, request: Request) -> None:
    if not settings.AUTH_RATE_LIMIT_ENABLED:
        return
    peer = request.client.host if request.client else "unknown"
    ip = resolve_client_ip(peer, request.headers, settings.TRUSTED_PROXY_IPS)
    retry_after = auth_limiter.hit(f"{scope}:{ip}", settings.AUTH_RATE_LIMIT_PER_MINUTE)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def rate_limit_login(request: Request) -> None:
    _enforce("login", request)


def rate_limit_register(request: Request) -> None:
    _enforce("register", request)
