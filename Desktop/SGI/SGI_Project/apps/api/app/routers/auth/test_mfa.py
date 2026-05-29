"""Tests MFA TOTP — helpers purs (sans DB ni réseau)."""
from __future__ import annotations

import pyotp
import pytest

from app.routers.auth.mfa import (
    decrypt_secret,
    encrypt_secret,
    generate_provisioning_uri,
    generate_totp_secret,
    verify_totp,
)


def test_generate_totp_secret_format() -> None:
    secret = generate_totp_secret()
    assert len(secret) == 32
    # Base32 : uniquement A-Z et 2-7.
    assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret)


def test_generate_totp_secret_unique() -> None:
    assert generate_totp_secret() != generate_totp_secret()


def test_encrypt_decrypt_roundtrip() -> None:
    secret = generate_totp_secret()
    encrypted = encrypt_secret(secret)
    assert encrypted != secret           # stocké chiffré
    assert decrypt_secret(encrypted) == secret


def test_encrypt_different_each_call() -> None:
    """Fernet utilise un IV aléatoire — deux chiffrements du même secret diffèrent."""
    s = generate_totp_secret()
    assert encrypt_secret(s) != encrypt_secret(s)


def test_provisioning_uri_format() -> None:
    secret = generate_totp_secret()
    uri = generate_provisioning_uri(secret, "test@sgi.ae")
    assert uri.startswith("otpauth://totp/")
    assert "SGI%20ERP" in uri or "SGI ERP" in uri
    assert "test%40sgi.ae" in uri or "test@sgi.ae" in uri


def test_verify_totp_valid_code() -> None:
    secret = generate_totp_secret()
    current_code = pyotp.TOTP(secret).now()
    assert verify_totp(secret, current_code) is True


def test_verify_totp_invalid_code() -> None:
    secret = generate_totp_secret()
    assert verify_totp(secret, "000000") is False


def test_verify_totp_empty_inputs() -> None:
    assert verify_totp("", "123456") is False
    assert verify_totp("SOMEBASE32SECRET", "") is False
    assert verify_totp("", "") is False


def test_verify_totp_wrong_length() -> None:
    secret = generate_totp_secret()
    assert verify_totp(secret, "12345") is False   # 5 digits
    assert verify_totp(secret, "1234567") is False  # 7 digits


pytestmark = pytest.mark.asyncio
