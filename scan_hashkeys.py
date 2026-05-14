"""
Сканер страниц hashkeys.space для поиска адреса пазла #71.
Сканирует случайные страницы и ищет целевой адрес.

Запуск:
    pip install requests beautifulsoup4
    python scan_hashkeys.py
"""

import requests
import random
import time
from bs4 import BeautifulSoup

TARGET_ADDRESS = "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"
BASE_URL = "https://hashkeys.space/71/"
TOTAL_PAGES = 1180591620717411304  # всего страниц в диапазоне
DELAY = 1.5  # секунд между запросами (чтобы не банили)

def scan_page(page: int) -> list[dict]:
    url = f"{BASE_URL}?page={page}"
    resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    keys_tag = soup.find("keys")
    results = []
    if not keys_tag:
        return results
    for div in keys_tag.find_all("div"):
        text = div.get_text(strip=True)
        parts = text.split()
        if len(parts) == 2:
            key_hex, address = parts
            results.append({"key_hex": key_hex, "address": address})
    return results

def main():
    print(f"Цель: {TARGET_ADDRESS}")
    print(f"Всего страниц: {TOTAL_PAGES:,}")
    print(f"Режим: случайные страницы, задержка {DELAY}с\n")

    scanned = 0
    keys_checked = 0

    while True:
        page = random.randint(1, TOTAL_PAGES)
        try:
            entries = scan_page(page)
            scanned += 1
            keys_checked += len(entries)

            for entry in entries:
                if entry["address"] == TARGET_ADDRESS:
                    print(f"\n{'='*50}")
                    print(f"НАЙДЕН! Страница: {page}")
                    print(f"Приватный ключ (hex): {entry['key_hex']}")
                    print(f"Адрес: {entry['address']}")
                    print(f"{'='*50}")
                    return

            print(f"Страница {page:>20,} | ключей: {len(entries)} | всего проверено: {keys_checked:,} | страниц: {scanned}")

        except requests.RequestException as e:
            print(f"Ошибка при загрузке страницы {page}: {e}")
            time.sleep(5)
            continue

        time.sleep(DELAY)

if __name__ == "__main__":
    main()
