# ArcSend Python Client (Parity)

The Python parity client is available under:

- `python/arcsend_sdk/client.py`

## Example

```python
from arcsend_sdk import ArcSendClient

client = ArcSendClient(base_url="http://localhost:4001")
client.login("demo@example.com", "password123")

balance = client.get_balance("arc-testnet")
print(balance["balance"])
```
