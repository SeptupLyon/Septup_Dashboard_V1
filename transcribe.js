export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audio, mimeType } = req.body;
  if (!audio) return res.status(400).json({ error: 'No audio provided' });

  const buffer = Buffer.from(audio, 'base64');
  const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, 'audio.' + ext);
  formData.append('model', 'whisper-1');
  formData.append('language', 'fr');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Transcription failed' });
  res.json({ text: data.text });
}
