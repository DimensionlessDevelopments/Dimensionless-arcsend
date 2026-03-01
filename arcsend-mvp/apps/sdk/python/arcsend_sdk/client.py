from typing import Optional, Dict, Any
import requests
import re


def _assert_backend_safe_credential(value: str, field_name: str) -> None:
    trimmed = value.strip()
    looks_like_circle_api_key = bool(re.match(r"^(TEST_API_KEY|LIVE_API_KEY):", trimmed, re.IGNORECASE))
    looks_like_entity_secret = bool(re.match(r"^[a-fA-F0-9]{64}$", trimmed))

    if looks_like_circle_api_key or looks_like_entity_secret:
        raise ValueError(
            f"{field_name} appears to be a Circle credential. Do not pass Circle API keys or Entity Secrets to the public SDK client. Use an ArcSend-issued auth token/API key from your backend auth layer."
        )


class ArcSendClient:
    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None):
        self.base_url = (base_url or "http://localhost:4001").rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        if token:
            _assert_backend_safe_credential(token, "token")
            self.set_token(token)

    def set_token(self, token: str) -> None:
        _assert_backend_safe_credential(token, "token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def clear_token(self) -> None:
        self.session.headers.pop("Authorization", None)

    def login(self, email: str, password: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/auth/login", json={"email": email, "password": password}
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("token")
        if token:
            self.set_token(token)
        return payload

    def wallet_challenge(self, address: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/auth/wallet/challenge", json={"address": address}
        )
        response.raise_for_status()
        return response.json()

    def wallet_verify(self, address: str, message: str, signature: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/auth/wallet/verify",
            json={"address": address, "message": message, "signature": signature},
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("token")
        if token:
            self.set_token(token)
        return payload

    def get_balance(self, chain: str = "arc-testnet") -> Dict[str, Any]:
        response = self.session.get(f"{self.base_url}/wallet/balance", params={"chain": chain})
        response.raise_for_status()
        return response.json()

    def list_wallets(self, include_balance: bool = False) -> Dict[str, Any]:
        params = {"includeBalance": "true"} if include_balance else None
        response = self.session.get(f"{self.base_url}/wallet/list", params=params)
        response.raise_for_status()
        return response.json()

    def estimate_transfer(
        self,
        destination_chain: str,
        amount: str,
        source_chain: Optional[str] = None,
        route_strategy: str = "auto",
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "toChain": destination_chain,
            "amount": amount,
        }
        if route_strategy == "manual" and source_chain:
            payload["fromChain"] = source_chain
        response = self.session.post(f"{self.base_url}/transfer/quote", json=payload)
        response.raise_for_status()
        return response.json()

    def send_transfer(
        self,
        destination_address: str,
        destination_chain: str,
        amount: str,
        source_chain: Optional[str] = None,
        route_strategy: str = "auto",
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "toChain": destination_chain,
            "amount": amount,
            "recipient": destination_address,
            "routeStrategy": route_strategy,
        }
        if route_strategy == "manual" and source_chain:
            payload["fromChain"] = source_chain
        response = self.session.post(f"{self.base_url}/transfer/send", json=payload)
        response.raise_for_status()
        return response.json()

    def get_transfer_status(self, transfer_id: str) -> Dict[str, Any]:
        response = self.session.get(f"{self.base_url}/transfer/status/{transfer_id}")
        response.raise_for_status()
        return response.json()

    def list_transactions(self) -> Dict[str, Any]:
        response = self.session.get(f"{self.base_url}/transactions")
        response.raise_for_status()
        return response.json()

    def get_transaction(self, transaction_id: str) -> Dict[str, Any]:
        response = self.session.get(f"{self.base_url}/transactions/{transaction_id}")
        response.raise_for_status()
        return response.json()

    def post_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        response = self.session.post(f"{self.base_url}/transactions/webhooks", json=payload)
        response.raise_for_status()
        return response.json()
