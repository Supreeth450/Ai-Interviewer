# AI Interview Platform

A modern AI-powered face-to-face interview platform with video recording, transcription, and coding round capabilities.

## Features

- **AI Interviewer**: Context-aware interview questions from Gemini or Ollama models
- **Video Recording**: Record yourself during the interview with downloadable files
- **Screen Recording**: Capture your entire screen during the interview process
- **Voice Transcription**: Real-time speech recognition with grammar correction
- **Note Taking**: Take notes with keyboard or drawing tools during interviews
- **Coding Round**: Separate coding challenge section with compiler functionality
- **Feedback System**: Get AI feedback on your interview answers

## Setup & Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-interview-platform.git
   cd ai-interview-platform
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following environment variables:
   ```
   gemini recommended and its free too any one among this is enough
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_COHERE_API_KEY=your_cohere_api_key
   NEXT_PUBLIC_RAPIDAPI_KEY=your_rapidapi_key

   Users need to replace API keys in these files:  this is very necessary and important step
   
1. app/f2f-interview/page.tsx - Line 482: Replace the
Gemini API key
2. app/coding-round/page.tsx - Line 81: Replace the
Gemini API key
3. Environment Variables: Create a env. local file with:
• NEXT_PUBLIC_COHERE_API_KEY=your_cohere_api_ke
• NEXT_PUBLIC_RAPIDAPI_KEY=your_rapidapi_key
   ```

   - **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Cohere API Key**: Get from [Cohere Dashboard](https://dashboard.cohere.ai/api-keys)
   - **RapidAPI Key**: Only needed for real compiler functionality in the coding round

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Ollama Integration (Optional)

For local AI interviewer functionality:

1. Install [Ollama](https://ollama.ai/download)
2. Pull the preferred model: `ollama pull llama2`
3. Create a custom model by editing `ollama/Modelfile`:
   ```
   FROM llama2
   SYSTEM "You are a professional technical interviewer."
   ```
4. Run: `ollama create my-interviewer -f Modelfile`
5. Start Ollama: `ollama serve`

## Usage

1. **Face-to-Face Interview**: Click "Start Interview" on the homepage
2. **Camera Controls**: Activate your camera and microphone
3. **AI Model**: Toggle between Gemini and Ollama
4. **Recording**: Use the recording buttons to capture video/audio
5. **Notes**: Click the Notes button for a popup notepad
6. **Coding Round**: Access the coding challenges from the header button

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **AI Integration**: Gemini API, Ollama API, Cohere API
- **UI Components**: Heroicons
- **Media**: WebRTC for camera/audio, Web Speech API for transcription

## Important Notes

- The `.env.local` file contains sensitive API keys and should not be committed to a public repository
- Gemini and Cohere API keys are required for full functionality
- Camera and microphone permissions are required for recording features
- For production deployment, secure your API endpoints appropriately 