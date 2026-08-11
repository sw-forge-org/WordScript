# 0117: Azure Speech is a Cloud credential, not a second ladder on the Enterprise row Azure OpenAI owns

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Classifies a vendor
[ADR 0116](0116-a-vendor-comes-in-because-it-serves-a-job-better-and-its-own-module-needs-a-reason.md)
admits, before somebody classifies it by its brand name.

## Context

Microsoft's MAI-Voice-2 and MAI-Voice-2-Flash are reached through **Azure
Speech**: host `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`,
header `Ocp-Apim-Subscription-Key`, body SSML, credential a Speech resource key
plus a region string.

`docs/PROVIDERS.md` already carries **Azure OpenAI** on the Enterprise lane:
endpoint plus deployment name plus key, or Entra ID, where *"the deployment name
is the model id"*.

**They share a corporate name and nothing else that matters here.** No
deployment concept, no tenant, a different host, a different header, a different
body format, a different resource type in the portal, and a different key.

**The lane definition in this repo already decides the question.**
`docs/PROVIDERS.md`'s lane table defines Enterprise as *"a cloud account with a
region **and a tenant**"* and Cloud as *"a vendor's own hosted API, one account,
one key"*. Azure Speech has a region and a key and no tenant. **It matches the
Cloud definition.**

**And the mistake it invites is one this document has already made twice.**
The survey records that Amazon Transcribe and Polly, and Google Cloud
Speech-to-Text and Text-to-Speech, are *"separate services with separate
endpoints and separate credentials, not a capability of the model-serving API
this lane authenticates against"* — that offering them on the Enterprise lane
*"would be a fourth and fifth adapter, not a checkbox."* Azure Speech is the
same relationship to Azure OpenAI that Polly has to Bedrock. The only difference
is that Microsoft ships both under one brand, which makes the wrong answer look
right.

## Decision

**Azure Speech is registered as a Cloud-lane vendor with its own credential** —
region plus subscription key — and is never folded into, gated behind, or
reached through the Azure OpenAI Enterprise adapter.

**Its credential is not the Enterprise credential and does not join that
ladder.** ADR 0094's rule that a job takes its own credential and never inherits
the default's already covers this; the risk is not the rule but the assumption
that one Azure account means one Azure credential, which is false.

**This is a decision and not a fact.** The endpoints and headers are facts and
belong in `docs/PROVIDERS.md`, where they are. Which lane a vendor is filed
under is a classification with a real wrong alternative — bolting Azure Speech
onto Azure OpenAI's ladder *because it is Azure* — and this record exists to
head that off before somebody writes it.

**And the adapter is optional, which is the second half.**
`microsoft/mai-voice-2` is on OpenRouter, on the shape ADR 0113 extracts, for no
module at all. **What the direct adapter buys is exactly one thing**: SSML, and
therefore the `mstts:express-as` styles — including the eighteen the two German
voices carry, which no other vendor in the survey matches. Whether that is worth
a module plus a credential ladder is a product question, and this record does
not answer it. It only fixes where the answer goes if it is yes.

## Consequences

- **It is the only vendor in this intake that needs a new credential shape.**
  Every other entrant is a bearer token against a base URL. That makes it the
  most expensive single row in the widened set and the one most likely to be
  deferred — correctly.
- **The Speech resource is region-scoped, so the region is part of the
  credential**, not a setting beside it. A key without its region does not
  resolve to a host.
- **Public preview, no SLA.** Microsoft says not to run production on it.
  Anything drawn for this lane says so, per the same rule that keeps `Not
  measured` on the Cartesia row.
- **Instant voice cloning is gated** behind Microsoft's Limited Access review
  with consent safeguards. It is not a feature this product can offer by calling
  an endpoint, and it should not be drawn as one.
- **It does not decide Azure Speech's recognition products.** Only MAI-Voice was
  surveyed, and it is synthesis. Azure Speech also transcribes; that is
  unsurveyed here and would be its own reading.
- **It is a precedent for reasoning, not a rule for Google.** If Google Cloud
  Speech-to-Text is ever brought in — the service Gemini's own documentation
  points at for dedicated transcription — the same argument is available and the
  same conclusion is likely, but it needs its own record.
