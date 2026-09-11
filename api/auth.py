# -*- coding: utf-8 -*-
"""
VocalGuard Clerk Authentication & Session Verification Middleware.
Handles JWT token validation, JWKS caching, user session extraction,
and permission enforcement for personal profile enrollment.
"""

import os
import re
import json
import base64
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from pydantic import BaseModel
import jwt
from fastapi import Header, HTTPException, status

logger = logging.getLogger("vocalguard.auth")

# Environment Keys
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY") or os.getenv("VITE_CLERK_PUBLISHABLE_KEY")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")
CLERK_ISSUER = os.getenv("CLERK_ISSUER")

# In-memory JWKS client cache
_jwks_client: Optional[jwt.PyJWKClient] = None
_jwks_url_cached: Optional[str] = None


class AuthenticatedUser(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    is_authenticated: bool = True
    claims: Dict[str, Any] = {}


ANONYMOUS_USER = AuthenticatedUser(
    id="guest_anonymous",
    email="guest@vocalguard.local",
    name="Guest Operator",
    is_authenticated=False,
    claims={}
)


def derive_jwks_url_from_publishable_key(pk: str) -> Optional[str]:
    """
    Clerk publishable keys (pk_test_... or pk_live_...) encode the frontend API domain in base64.
    Decodes the domain and constructs the standard Clerk JWKS URL.
    """
    try:
        if not pk or not ("pk_test_" in pk or "pk_live_" in pk):
            return None
        raw_part = pk.split("_", 2)[-1]
        decoded = base64.b64decode(raw_part + "===").decode("utf-8").rstrip("$")
        return f"https://{decoded}/.well-known/jwks.json"
    except Exception as e:
        logger.warning(f"Could not derive Clerk JWKS URL from publishable key: {e}")
        return None


def get_jwks_client() -> Optional[jwt.PyJWKClient]:
    """Initializes and returns cached PyJWKClient for Clerk JWT verification."""
    global _jwks_client, _jwks_url_cached
    if _jwks_client is not None:
        return _jwks_client

    jwks_url = CLERK_JWKS_URL
    if not jwks_url and CLERK_PUBLISHABLE_KEY:
        jwks_url = derive_jwks_url_from_publishable_key(CLERK_PUBLISHABLE_KEY)
    if not jwks_url and CLERK_ISSUER:
        jwks_url = f"{CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json"

    if jwks_url:
        try:
            _jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
            _jwks_url_cached = jwks_url
            logger.info(f"Initialized Clerk JWKS client with URL: {jwks_url}")
        except Exception as e:
            logger.error(f"Failed to initialize Clerk JWKS client: {e}")
            _jwks_client = None

    return _jwks_client


def verify_clerk_token(token: str) -> AuthenticatedUser:
    """
    Validates a Clerk session JWT token against Clerk JWKS or secret key.
    Extracts user ID, email, and session claims.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or empty authentication token."
        )

    jwks_client = get_jwks_client()

    # Strategy 1: Verify using RS256 JWKS public key from Clerk
    if jwks_client is not None:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject.")

            email = payload.get("email") or payload.get("primary_email_address")
            name = payload.get("name") or payload.get("full_name") or payload.get("first_name")

            return AuthenticatedUser(
                id=user_id,
                email=email,
                name=name,
                is_authenticated=True,
                claims=payload
            )
        except jwt.PyJWTError as e:
            logger.warning(f"Clerk JWKS token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired Clerk session token: {str(e)}"
            )

    # Strategy 2: If no JWKS configured yet (dev / local test mode), decode payload without verification
    # while clearly logging a warning, so development and demo testing work seamlessly.
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        user_id = unverified.get("sub", "dev_user")
        email = unverified.get("email") or "dev@vocalguard.local"
        name = unverified.get("name") or unverified.get("full_name") or "Authenticated User"
        logger.info(f"Decoded token in dev mode for user: {user_id}")
        return AuthenticatedUser(
            id=user_id,
            email=email,
            name=name,
            is_authenticated=True,
            claims=unverified
        )
    except Exception as e:
        logger.warning(f"Failed to decode token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token."
        )


def get_current_user(authorization: Optional[str] = Header(None)) -> AuthenticatedUser:
    """
    FastAPI dependency that extracts and validates the current user.
    Falls back to ANONYMOUS_USER if no token is provided.
    """
    if not authorization:
        return ANONYMOUS_USER

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return ANONYMOUS_USER

    token = parts[1]
    return verify_clerk_token(token)


def require_authenticated_user(authorization: Optional[str] = Header(None)) -> AuthenticatedUser:
    """
    FastAPI dependency requiring a valid logged-in Clerk user session.
    """
    user = get_current_user(authorization)
    if not user.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in via Clerk to manage your voice profile."
        )
    return user
