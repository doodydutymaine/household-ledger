# Household Ledger

A small self-hosted budget calculator that replicates your spreadsheet's logic:
overtime-aware income for two earners, a flexible expense list, a vehicle cost
calculator (payment + fuel cost from miles/MPG/price-per-gallon), a credit card
payoff calculator (balance + APR + payoff-months → monthly payment and total
interest), and — the thing the spreadsheet never had — a **Forecast** page that
projects your savings balance forward to any target month, including one-time
future income or expenses.

All data is saved automatically to a single JSON file in `/data`, so it
persists across container restarts and updates.

## Option A: docker-compose

```bash
cd household-ledger
docker compose up -d --build
```

Visit `http://127.0.0.1:5008`.

## Option B: Podman + Quadlet (matches your other containers)

1. Copy this whole folder to your Fedora server, e.g. `~/household-ledger-src`.
2. Build the image:
   ```bash
   cd ~/household-ledger-src
   podman build -t localhost/household-ledger:latest .
   ```
3. Create the data directory:
   ```bash
   mkdir -p ~/household-ledger-data
   ```
4. Copy `household-ledger.container` into your Quadlet directory:
   ```bash
   cp household-ledger.container ~/.config/containers/systemd/
   ```
5. Start it:
   ```bash
   systemctl --user daemon-reload
   systemctl --user start household-ledger.service
   systemctl --user status household-ledger.service
   ```
6. Confirm it's listening:
   ```bash
   curl -I http://127.0.0.1:5008
   ```

## Adding it to your Cloudflare Tunnel

Same pattern as your other two apps: in the tunnel's **Public Hostname**
settings, add a subdomain (e.g. `ledger`) pointing to `http://127.0.0.1:5008`,
then add it as a self-hosted application in Cloudflare Access with the same
email allow-list policy.

## Notes

- Because this image is built locally rather than pulled from a registry,
  `podman auto-update` won't do anything for it — there's no registry to
  check against. To update it after you change the code, rebuild the image
  and run `systemctl --user restart household-ledger.service`.
- Credit card payoff math uses standard amortization (like a loan): given a
  balance, APR, and how many months you want it paid off in, it calculates
  the fixed monthly payment and total interest — same math your spreadsheet's
  `PMT` formula was doing.
- The vehicle fuel cost formula is `(miles/day × days/week × weeks/month ÷
  MPG) × price/gallon`, matching your original calculation.
