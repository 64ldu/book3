import 'dotenv/config';

export async function handler(event, context) {
  const { httpMethod, path, body, headers } = event;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders };
  }

  try {
    if (path === '/api/voices' && httpMethod === 'GET') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing ELEVENLABS_API_KEY' })
        };
      }

      const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!upstream.ok) {
        const msg = await upstream.text().catch(() => '');
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'ElevenLabs voices request failed', status: upstream.status, details: msg })
        };
      }

      const data = await upstream.json();
      const voices = Array.isArray(data?.voices) ? data.voices : [];

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
        body: JSON.stringify({ voices: voices.map(v => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category
        })) })
      };
    }

    if (path === '/api/tts' && httpMethod === 'POST') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17';

      if (!apiKey) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing ELEVENLABS_API_KEY' })
        };
      }

      const parsedBody = JSON.parse(body || '{}');
      const text = (parsedBody?.text || '').toString().trim();
      const voiceId = (parsedBody?.voiceId || defaultVoiceId || '').toString().trim();

      if (!text) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing text' })
        };
      }

      if (!voiceId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing ELEVENLABS_VOICE_ID (or voiceId in request)' })
        };
      }

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`;

      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      });

      if (!upstream.ok) {
        const msg = await upstream.text().catch(() => '');
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'ElevenLabs request failed', status: upstream.status, details: msg })
        };
      }

      const arrayBuffer = await upstream.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
        body: base64,
        isBase64Encoded: true
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server error', details: err?.message || String(err) })
    };
  }
}
