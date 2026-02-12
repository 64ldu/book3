import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(process.cwd()));

app.get('/api/voices', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing ELEVENLABS_API_KEY' });
    }

    const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!upstream.ok) {
      const msg = await upstream.text().catch(() => '');
      return res.status(502).json({ error: 'ElevenLabs voices request failed', status: upstream.status, details: msg });
    }

    const data = await upstream.json();
    const voices = Array.isArray(data?.voices) ? data.voices : [];

    res.setHeader('Cache-Control', 'no-store');
    res.json({ voices: voices.map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err?.message || String(err) });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing ELEVENLABS_API_KEY' });
    }

    const text = (req.body?.text || '').toString().trim();
    const voiceId = (req.body?.voiceId || defaultVoiceId || '').toString().trim();

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    if (!voiceId) {
      return res.status(400).json({ error: 'Missing ELEVENLABS_VOICE_ID (or voiceId in request)' });
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
      return res.status(502).json({ error: 'ElevenLabs request failed', status: upstream.status, details: msg });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err?.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
