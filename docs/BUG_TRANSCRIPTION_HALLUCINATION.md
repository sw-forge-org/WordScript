# Transkriptions-Halluzinationen (Sprachverlust, Trainingsdaten-Leakage)

Stand: 2026-07-24
Status: **Offen, ungeloest** — nur Dokumentation, keine Massnahme umgesetzt.

## Symptom

In allen Modi (`auto`, `cleanup`, `rewrite`, `agent`, `prompt_enhance`,
`verbatim`) und allen Profilen ist die Roh-Transkription unsauber. Die
Halluzinationen entstehen **vor** der Cleanup-Stufe, also im STT-Output selbst
(Groq/Whisper-large-v3-turbo Cloud-Pfad sowie lokaler `whisper-cli`-Pfad), nicht
im LLM-Korrektur-Post-Processing. Konkret beobachtet:

1. **Sprachverlust / Fremdsprach-Schnipsel.** Bei deutschem Input tauchen
   portugiesische, brasilianisch-portugiesische und chinesische Phrasen im
   Transkript auf. Das Modell springt mitten in einem Satz oder am Stille-Ende
   in eine andere Sprache. Typisch fuer Whisper bei niedriger Audioqualitaet,
   Background-Noise oder Ambience, das in eine Trainingsdomaene passt.
2. **Trainingsdaten-Leakage.** Bei deutschem Diktat erscheint gelegentlich
   Untertitelungs-Artefakt-Text, z.B. "ZDF 2020" oder aehnliche
   Broadcast-Untertitel-Reste. Das ist klassisches Whisper-Halluzinationsverhalten
   aus dem Subtitles-Trainingskorpus (Amara.org, YouTube-Auto-Captions,
   Sendertitel-Schnipsel).
3. **Closing-Phrasen-Halluzination.** "Thanks for watching", "Bitte abonnieren",
   "[Musik]", "[Applause]" u.ae. — der bestehende `is_hallucination`-Filter in
   `src-tauri/src/core/transform.rs:691` deckt **genau diese** Closing-Phrase-Klasse
   ab, aber **nur nachtraeglich** in der Cleanup-Stufe und **nur**, wenn der
   gesamte Output (bzw. ein Prefix) der Phrase entspricht. Eingebettete
   Schnipsel mitten im Text oder gemischtsprachige Artefakte fallen durch.

## Betroffener Pfad

- Cloud: `src-tauri/src/core/providers/groq.rs:268` — `language`- und
  `prompt`-Parameter werden an die Groq-Whisper-API gesetzt, aber
  `language` ist nur ein *Hint*; Whisper-large-v3-turbo ignoriert ihn bei
  Mehrdeutigkeit oder niedrigem SNR und faellt auf Sprachdetektion zurueck,
  die dann in die Trainingsdomaene driftet.
- Lokal: `src-tauri/src/core/providers/local_preview.rs:366` — analog
  `--language` + `--prompt` + `--carry-initial-prompt` an `whisper-cli`.
- Bias-Pfad (`transcription_hints.rs`): Profil-/Dictionary-/STT-Hints werden
  als `prompt`/`initial_prompt` weitergereicht. Der Conservative-Modus schliesst
  Profil-Hints vom Cloud-Prompt aus (verhindert *englischen* Language-Bias aus
  englischen Profilbegriffen), aber das loest das Grundproblem nicht: ein
  deutschsprachiges `prompt` mit deutschen Phrasen bias't zwar Richtung Deutsch,
  behebt aber nicht, dass Whisper bei Stille/Low-SNR Fremdsprach- oder
  Subtitles-Artefakte *generiert*.
- Cleanup-Filter `transform.rs:691 is_hallucination`: reiner
  Post-Processing-String-Matcher, wirkt **nicht** auf den STT-Rohoutput vor
  dem Insert, und nur auf ganze Prefixes/Exact-Matches. Eingebettete
  Fremdsprach-Schnipsel mitten im Satz: nicht abgedeckt.

## Wurzel-Hypothese (zur Untersuchung, nicht als Fakt dokumentiert)

Whisper-large-v3-turbo (und ggml-Derivate) sind bekannte Halluzinatoren bei:
- Stille / Trailing-Silence nach dem letzten Wort → Closing-Phrasen.
- Ambience, Background-Music, Low-SNR → Sprachwechsel in Trainingsdomaenen.
- Sehr kurze Eingaben (<2-3s) → Generierung aus `initial_prompt` statt Audio.

Die `language`-Hint-Funktion der OpenAI/Groq-Whisper-API ist **kein** Force-Lock;
sie senkt nur die Wahrscheinlichkeit des Sprachwechsels. Das ist dokumentiertes
Verhalten, kein Bug aufseiten der Provider.

## Was WordScript heute schon tut (und warum es nicht reicht)

- `language`-Hint an STT-Provider: gesendet, aber nur Empfehlung.
- Profil-Hints vom Cloud-`prompt` ausgeschlossen (Conservative): schuetzt vor
  *englischem* Language-Bias aus englischen Profil-Begriffen, behebt aber nicht
  das Fremdsprach-Drift-Problem aus dem Audio selbst.
- `is_hallucination`-Filter (transform.rs): Post-Cleanup-String-Matcher fuer
  Closing-Phrasen/Untertitel-Artefakte. Wird zu spaet und zu eng angewendet.
- Cleanup-System-Prompt (transform.rs:453) enthaelt
  "Sprachmix exakt beibehalten" und "gemischtsprachige Woerter erhalten" — das
  ist **richtig** fuer legitime gemischtsprachige Diktate, ist aber
  kontraproduktiv fuer *Halluzinations*-Fremdsprach-Schnipsel, die erhalten
  bleiben, obwohl sie nie gesprochen wurden.

## Untersuchungsbedarf (Lead-Tool-Analyse, Donors)

Nach Vorgabe: **keine Implementierung**, nur Dokumentation des Problems und der
Untersuchungspfade. Die folgenden Quellen sollen herangezogen werden, um das
Lösungsmuster abzuleiten — Stand heute nicht ausgewertet:

### Donor-Repos (lokal unter `sw-bench/`, eingefrorene Referenz in `docs/donors/`)

- **Whisper-Input-Next** — "two-pass recognition": erstes Pass roh, zweites
  Pass mit First-Pass-Output als Kontext. Relevant fuer: Halluzination im
  Stille-Bereich erkennen via Second-Pass-Diff gegen First-Pass.
- **openwhispr** — Multi-Provider-Orchestrierung. Relevant fuer: Provider-
  Level-Config, die Sprach-Lock staerker erzwingt (z.B. faster-whisper
  `language` + `beam_size` + `hallucination_silence_threshold`).
- **voxtype / hyprwhspr** — Linux-hybrid-Backends, teils faster-whisper-basiert.
  Relevant fuer: faster-whisper-Parameter, die Whisper.cpp nicht hat
  (`hallucination_silence_threshold_sec`, `no_speech_threshold`,
  `compression_ratio_threshold`, `condition_on_previous_text`).
- **Handy** — Architekturkern. Relevant fuer: wie es das
  STT-Output-Post-Filter-Stage-Pattern strukturiert.
- **FluidVoice** — low-latency live-preview. Relevant fuer: Streaming-Modus,
  bei dem Stille-Halluzinationen in Echtzeit unterdrueckt werden.
- **chirp-stt** — Windows local-first. Relevant fuer: lokale
  ggml/whisper.cpp-Parametrisierung ohne Cloud-Fallback.

### Externe Referenzen (Lead-Tools, Dokumentation)

- **faster-whisper** (SYSTRAN/faster-whisper) — dokumentiert
  `hallucination_silence_threshold_sec` und
  `condition_on_previous_text=False` als Hauptmittel gegen
  Stille-End-Halluzinationen und Prompt-Bleed. WordScripts lokaler Pfad
  nutzt `whisper-cli` (ggml), das diese Parameter nur teilweise kennt.
- **whisper.cpp** (ggml) — `--no-context` (deaktiviert
  `condition_on_previous_text`) und `--prompt` als Halluzinations-Hebel;
  `--max-len` Token-Budget-Begrenzung als Closing-Phrase-Verhinderung.
- **OpenAI Whisper API** — `language` + `prompt` sind die einzigen Hebel; kein
  `no_speech_threshold`-Expose. Das erklaert, warum der Cloud-Pfad
  (Groq-hosted-v3-turbo) anfaelliger ist als ein gut parametrisierter lokaler
  faster-whisper-Lauf.

### Hypothesen fuer Loesungsansaetze (nur fuer spaetere Auswertung, nicht jetzt)

1. **Local-first mit faster-whisper statt whisper-cli**, sofern
   Linux-Verfuegbarkeit: `hallucination_silence_threshold_sec=2.0` +
   `condition_on_previous_text=False` + `no_speech_threshold=0.6` +
   `compression_ratio_threshold=2.4` (Whisper-Default). Dies ist der
   dokumentierte Goldstandard gegen genau diese Symptomklasse.
2. **Cloud-Pfad: Post-STT-Halluzinations-Detektor** als echte Pipeline-Stage
   (nicht nur der heutige String-Filter im Cleanup). Heuristiken:
   - Compression-Ratio-Vorabschaetzung (Token/Wort-Wiederholungsdichte).
   - Sprache-Wechsel-Mitten-im-Satz-Detektion (bestehender
     `detect_primary_language` aus `prompt_enhance.rs:365` ist rudimentaer;
     braucht robustere Multi-Sprach-Segment-Detektion, z.B. Unicode-Block-
     Scan fuer CJK vs Latin + Naive-Bayes-Sprachzaehler pro Segment).
   - Trailing-Silence-Segment vs generierter Text-Luecken-Check.
3. **Second-Pass-Re-Transcription** mit dem First-Pass-Result als
   `prompt`-Kontext (Whisper-Input-Next-Pattern), um generierte
   Fremdsprach-Schnipsel durch einen Re-Pass zu eliminieren.
4. **VAD-Pre-Processing** (z.B. silero-vad) vor STT, damit Stille gar nicht
   erst an Whisper gelangt — unterbindet die dominante Wurzel
   (Trailing-Silence → Closing-Phrase) an der Quelle statt nachtraeglich.

## Scope dieser Notiz

Diese Datei ist **nur** die Problemdokumentation. Kein Code, kein Skill-Aufruf,
kein spec-sync, keine Aenderung an `STATUS.md` oder `ROADMAP.md`. Loesungs-
Ableitung und Implementation folgen in einem separaten, explizit
angestossenen Slice.