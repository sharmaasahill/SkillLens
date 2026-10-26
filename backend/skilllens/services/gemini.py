"""Google Gemini, called over its REST API (no extra Python package needed).

Nothing here runs without GEMINI_API_KEY in backend/.env. Requests ask for JSON that follows a
schema, so answers can be checked before anyone sees them. When a model is busy, slow or out of
free quota, the next model in GEMINI_MODELS is tried.
"""
import json
import logging
import time
import urllib.error
import urllib.request

from flask import current_app

logger = logging.getLogger(__name__)

API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
# A busy model gives up sooner when there is another to try; the last one gets longer
TIMEOUT_SECONDS = 30
LAST_TIMEOUT_SECONDS = 60
RETRY_STATUSES = {408, 429, 500, 502, 503, 504}  # worth trying the next model
# After a model is busy, slow or out of quota, skip it for a while so the next reviews are quick
COOL_DOWN_SECONDS = 10 * 60
_cooling = {}  # model -> time it may be tried again


class GeminiError(Exception):
    """Gemini could not answer. `message` is safe to show to users."""

    def __init__(self, message, status=503, quota=False):
        super().__init__(message)
        self.message = message
        self.status = status
        self.quota = quota


def configured():
    return bool(current_app.config.get('GEMINI_API_KEY'))


def models():
    """Models to try, in order, leaving out any that are cooling down (unless every one is)."""
    configured_models = list(current_app.config.get('GEMINI_MODELS') or [])
    now = time.time()
    ready = [m for m in configured_models if _cooling.get(m, 0) <= now]
    return ready or configured_models


def _cool(model):
    _cooling[model] = time.time() + COOL_DOWN_SECONDS


def _post(model, body, timeout):
    request = urllib.request.Request(
        API_URL.format(model=model), data=json.dumps(body).encode('utf-8'), method='POST',
        headers={'x-goog-api-key': current_app.config['GEMINI_API_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 (fixed https host)
        return json.loads(response.read().decode('utf-8'))


def _text(data):
    """The answer text, skipping the model's private reasoning parts."""
    candidates = data.get('candidates') or []
    if not candidates:
        reason = (data.get('promptFeedback') or {}).get('blockReason')
        raise GeminiError(f'Gemini declined to answer ({reason}).' if reason else 'Gemini returned no answer.', 502)
    candidate = candidates[0]
    parts = (candidate.get('content') or {}).get('parts') or []
    text = ''.join(p.get('text', '') for p in parts if not p.get('thought'))
    if candidate.get('finishReason') == 'MAX_TOKENS':
        raise GeminiError('Gemini ran out of room for its answer. Try again with a shorter job description.', 502)
    if not text.strip():
        raise GeminiError('Gemini returned an empty answer.', 502)
    return text


def generate_json(prompt, schema, system=None, temperature=0.3, max_tokens=8192):
    """Ask for JSON matching `schema`. Returns (parsed dict, model used). Raises GeminiError."""
    if not configured():
        raise GeminiError('AI review is not set up on this server.', 404)
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {
            'responseMimeType': 'application/json',
            'responseJsonSchema': schema,
            'temperature': temperature,
            'maxOutputTokens': max_tokens,
            'thinkingConfig': {'thinkingLevel': 'low'},
        },
    }
    if system:
        body['systemInstruction'] = {'parts': [{'text': system}]}

    last, quota_hit = None, False
    chain = models()
    for position, model in enumerate(chain):
        timeout = LAST_TIMEOUT_SECONDS if position == len(chain) - 1 else TIMEOUT_SECONDS
        try:
            data = _post(model, body, timeout)
            _cooling.pop(model, None)
            return json.loads(_text(data)), model
        except urllib.error.HTTPError as exc:
            detail = ''
            try:
                detail = json.loads(exc.read().decode('utf-8')).get('error', {}).get('message', '')
            except (ValueError, AttributeError):
                pass
            logger.warning('Gemini %s returned %s: %s', model, exc.code, detail[:200])
            if exc.code in (400, 401, 403) and 'key' in detail.lower():
                raise GeminiError('The Gemini API key was rejected. Check GEMINI_API_KEY in backend/.env.', 502)
            quota_hit = quota_hit or exc.code == 429
            last = exc
            if exc.code not in RETRY_STATUSES:
                break
            _cool(model)
        except (urllib.error.URLError, TimeoutError) as exc:
            logger.warning('Gemini %s failed: %s', model, exc)
            last = exc
            _cool(model)
        except (ValueError, GeminiError) as exc:  # unreadable JSON or an empty answer: the next model may do better
            logger.warning('Gemini %s gave an unusable answer: %s', model, exc)
            last = exc
    if quota_hit:
        raise GeminiError("Today's free Gemini quota is used up. Try again tomorrow.", 429, quota=True)
    if isinstance(last, GeminiError):
        raise last
    raise GeminiError('Gemini is busy right now. Try again in a minute.', 503)
