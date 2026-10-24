// ============================================================================
// Claude Messages API cevabından metin çıkarma (2026-10-24)
// ----------------------------------------------------------------------------
// Claude 5.x modelleri uyarlanabilir düşünmeyi varsayılan açar: cevabın ilk
// bloğu `thinking` olabilir, metin ikinci blokta gelir. `content[0].text`
// okuyan eski çağrıcılar bu yüzden sessizce boş dönüyordu (24 Eki: /api/analyze
// "Claude pasif", anahtar geçerliyken). Metin bloklarını tipine göre topla;
// isteklerde `thinking: disabled` gönder ki max_tokens düşünmeye gitmesin.
// ============================================================================

export interface ClaudeContentBlock { type: string; text?: string }

/** Tüm `text` bloklarını birleştirir; yoksa null. Girdi bozuksa null. */
export function claudeText(data: unknown): string | null {
  const blocks = (data as { content?: unknown } | null | undefined)?.content;
  if (!Array.isArray(blocks)) return null;
  const text = blocks
    .filter((b): b is ClaudeContentBlock => !!b && typeof b === 'object' && (b as ClaudeContentBlock).type === 'text' && typeof (b as ClaudeContentBlock).text === 'string')
    .map((b) => b.text as string)
    .join('');
  return text || null;
}

/** İstek gövdesine yayılır: `{ model, ...CLAUDE_NO_THINKING, max_tokens, messages }`. */
export const CLAUDE_NO_THINKING = { thinking: { type: 'disabled' as const } };
