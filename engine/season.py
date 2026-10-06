"""
Sezon penceresi + isim-eşleme kapsama kuralı (saf, testli).

Neden (2026-10-06): publish_xg.py'de START/END = 2024,2025 ve ref = 1 Temmuz 2026
sabitti. 2025/26 bitince büyük 5 ligin parametreleri aynı 760/612 maçla eğitilmeye
devam etti; 2026/27 hiç görülmedi (dc_model_params.trained_matches Haziran'dan beri
sabit). Burada pencere bugünden türetilir; takım listesi canlıysa kapsama kuralı
"bu sezonun takımları %100 eşleşsin" olur (küme düşenler eşleşmese de yazım durmaz).
"""
from datetime import datetime, timezone


def season_start_year(ref):
    """FD.co.uk / Understat sezonu Ağustos'ta başlar: Ağu–Ara → aynı yıl, Oca–Tem → önceki yıl."""
    return ref.year if ref.month >= 8 else ref.year - 1


def season_window(ref, seasons=2):
    """(START, END): END = içinde bulunulan sezonun başlangıç yılı, START = END-(seasons-1)."""
    end = season_start_year(ref)
    return end - (seasons - 1), end


def now_naive_utc():
    """Veri tarihleri naive datetime (data.py) — referans da naive UTC olmalı."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def coverage(mapping, fd_teams, current_teams):
    """
    Eşleme kapsaması.
      current_teams verilmişse (canlı liste): unmatched = bu sezon takımı olup hiçbir FD
        takımına eşlenmeyenler (KRİTİK — tahmin anında parametre bulunamaz), dropped = FD
        takımı olup eşlenmeyenler (küme düşen/eski; zararsız), coverage_pct = eşlenen bu-sezon
        takımı yüzdesi.
      current_teams None ise eski kural: unmatched = eşlenmeyen FD takımları, coverage FD üstünden.
    Döner: (unmatched, dropped, coverage_pct, mapped_count)
    """
    mapped_targets = set(mapping.values())
    if current_teams is None:
        unmatched = [t for t in fd_teams if t not in mapping]
        pct = (len(fd_teams) - len(unmatched)) / len(fd_teams) * 100 if fd_teams else 0.0
        return unmatched, [], pct, len(mapping)
    unmatched = [t for t in current_teams if t not in mapped_targets]
    dropped = [t for t in fd_teams if t not in mapping]
    pct = (len(current_teams) - len(unmatched)) / len(current_teams) * 100 if current_teams else 0.0
    return unmatched, dropped, pct, len(mapping)
