import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const config = {
  maxDuration: 60,
};

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://for-all-cdd08.web.app',
  'https://for-all-cdd08.firebaseapp.com',
];

function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaultOrigins, ...extra])];
}

function corsHeaders(origin) {
  const allowOrigin = origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(res, status, body, origin) {
  res.statusCode = status;
  Object.entries({ ...corsHeaders(origin), 'Content-Type': 'application/json' }).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.end(JSON.stringify(body));
}

function firebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('missing-service-account');
  }

  return initializeApp({
    credential: cert(JSON.parse(raw)),
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'method-not-allowed' }, origin);
    return;
  }

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    json(res, 412, { error: 'missing-openai-key' }, origin);
    return;
  }

  const authorization = req.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    json(res, 401, { error: 'unauthenticated' }, origin);
    return;
  }

  try {
    await getAuth(firebaseApp()).verifyIdToken(token);
  } catch {
    json(res, 401, { error: 'unauthenticated' }, origin);
    return;
  }

  const model = typeof req.body?.model === 'string' ? req.body.model : '';
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const schema = req.body?.schema;

  if (!model || messages.length === 0 || !schema) {
    json(res, 400, { error: 'invalid-argument' }, origin);
    return;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'itinerary',
          strict: true,
          schema,
        },
      },
    }),
  });

  if (response.status === 401) {
    json(res, 412, { error: 'missing-openai-key' }, origin);
    return;
  }

  if (!response.ok) {
    json(res, 502, { error: 'openai-failed' }, origin);
    return;
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    json(res, 502, { error: 'invalid-openai-response' }, origin);
    return;
  }

  json(res, 200, { content }, origin);
}
