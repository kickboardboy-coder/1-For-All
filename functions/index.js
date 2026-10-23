import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const openaiKey = defineSecret('OPENAI_API_KEY');

export const openaiChat = onCall(
  {
    region: 'asia-northeast3',
    secrets: [openaiKey],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const model = typeof request.data?.model === 'string' ? request.data.model : '';
    const messages = Array.isArray(request.data?.messages) ? request.data.messages : [];
    const schema = request.data?.schema;

    if (!model || messages.length === 0 || !schema) {
      throw new HttpsError('invalid-argument', '최적화 요청이 올바르지 않습니다.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey.value()}`,
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
      throw new HttpsError('failed-precondition', 'OpenAI API 키를 설정해 주세요.');
    }

    if (!response.ok) {
      throw new HttpsError('internal', '최적화를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new HttpsError('internal', '최적화 결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    return { content };
  },
);
