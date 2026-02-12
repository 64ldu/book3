# Interactive Book

## Overview
An interactive 3D book application with page-flipping animations and optional text-to-speech narration via ElevenLabs API.

## Project Architecture
- **Runtime**: Node.js 20 with Express
- **Frontend**: Vanilla HTML/CSS/JS served as static files
- **Backend**: Express server (`server.js`) with two API endpoints:
  - `GET /api/voices` - Fetches available ElevenLabs voices
  - `POST /api/tts` - Text-to-speech synthesis via ElevenLabs
- **Port**: 5000

## File Structure
- `server.js` - Express server entry point
- `index.html` - Main HTML page
- `script.js` - Client-side JavaScript (book interactions, narration)
- `styles.css` - Styling and 3D book animations
- `package.json` - Node.js dependencies

## Environment Variables
- `ELEVENLABS_API_KEY` - Required for TTS functionality
- `ELEVENLABS_VOICE_ID` - Optional default voice ID
- `ELEVENLABS_MODEL_ID` - Optional model override (defaults to `eleven_multilingual_v2`)

## Running
```
node server.js
```
Server starts on port 5000.
