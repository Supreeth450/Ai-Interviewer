'use client';

import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, NoSymbolIcon, VideoCameraIcon, XCircleIcon, ArrowDownTrayIcon, ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';

// Define the SpeechRecognition type
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function F2FInterview() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaStreamActive, setMediaStreamActive] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [recordedChunks, setRecordedChunks] = useState<BlobPart[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  // Add chat state
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useGeminiAI, setUseGeminiAI] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Add state for editing mode and editable transcript
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [editableTranscript, setEditableTranscript] = useState<string>('');
  const editTranscriptRef = useRef<HTMLTextAreaElement>(null);

  // Add state for interview features
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userResponse, setUserResponse] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');
  const [questions, setQuestions] = useState<{question: string, feedback: string}[]>([
    { 
      question: "Tell me about yourself", 
      feedback: "Your introduction should highlight your technical skills, relevant projects, and professional experience. Be concise but comprehensive."
    }
  ]);
  const responseTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Add state to track if feedback for response is shown
  const [responseSubmitted, setResponseSubmitted] = useState<boolean>(false);
  const [aiResponseFeedback, setAiResponseFeedback] = useState<string>('');

  // Let's add a flag to prevent duplicate message processing
  const [processingMessage, setProcessingMessage] = useState<boolean>(false);

  // Add state to track which message is currently being viewed
  const [currentViewIndex, setCurrentViewIndex] = useState<number>(0);

  // Add new state variables for screen recording
  const [isScreenRecording, setIsScreenRecording] = useState<boolean>(false);
  const [screenRecordedChunks, setScreenRecordedChunks] = useState<BlobPart[]>([]);
  const [screenDownloadUrl, setScreenDownloadUrl] = useState<string>('');
  const screenMediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Add refs for audio elements
  const startRecordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopRecordingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Add state for notes popup
  const [showNotesPopup, setShowNotesPopup] = useState<boolean>(false);
  const [activeNoteTool, setActiveNoteTool] = useState<'pen' | 'eraser' | 'keyboard'>('keyboard');
  const [notes, setNotes] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingContext, setDrawingContext] = useState<CanvasRenderingContext2D | null>(null);

  // Add a function to correct the transcription using Cohere API
  const correctTranscriptionWithCohere = async (text) => {
    if (!text || text.trim() === '') return text;

    try {
      const apiKey = process.env.NEXT_PUBLIC_COHERE_API_KEY;
      
      // If no API key is available, return the original text
      if (!apiKey) {
        console.warn("Cohere API key not found. Set NEXT_PUBLIC_COHERE_API_KEY in .env.local");
        return text;
      }
      
      const response = await fetch("https://api.cohere.ai/v1/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "command-r-plus",
          prompt: `Correct only grammar issues and fix technical terms in this transcribed text without adding any commentary:

Original: ${text}

Corrected:`,
          max_tokens: 500,
          temperature: 0.3,
          stop_sequences: ["\n\n"]
        })
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.generations && data.generations.length > 0) {
        // Extract only the corrected text, removing any prefixes like "Corrected:" 
        let correctedText = data.generations[0].text.trim();
        
        // Remove any prefixes that might have been included
        correctedText = correctedText.replace(/^(Corrected:|Here is the corrected text:|The corrected text is:)/i, '').trim();
        
        // If the response seems to contain the whole prompt, only return original text
        if (correctedText.includes("Original:") && correctedText.includes("Corrected:")) {
          console.warn("Cohere response contained prompt instructions. Using original text.");
          return text;
        }
        
        return correctedText;
      }
      return text;
    } catch (error) {
      console.error("Error correcting transcription:", error);
      return text; // Return original text on error
    }
  };

  const startTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    
    // Optimize recognition settings for better accuracy
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.maxAlternatives = 3; // Increase alternatives to choose the best match
    recognitionRef.current.lang = 'en-US'; // Set to English for better accuracy
    
    // Shorter phrases for more frequent processing
    recognitionRef.current.interimResults = true;
    recognitionRef.current.continuous = true;

    // Track previous results to detect and fix errors
    let previousResults = [];
    const maxPreviousResults = 5;
    
    // Add a dictionary of common tech terms for better recognition
    const techTerms = [
      'JavaScript', 'Python', 'Java', 'React', 'Angular', 'Vue', 'Node.js', 
      'TypeScript', 'MongoDB', 'SQL', 'database', 'API', 'REST', 'GraphQL',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'DevOps', 'CI/CD', 'Git', 'GitHub',
      'algorithm', 'data structure', 'frontend', 'backend', 'full-stack'
    ];
    
    // Function to improve text with proper capitalization and tech terms
    const improveText = (text) => {
      // Basic sentence capitalization
      let improved = text.replace(/\.\s+[a-z]/g, match => 
        match.toUpperCase());
      
      // Capitalize first letter of the text
      if (improved.length > 0) {
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
      }
      
      // Fix common tech terms
      techTerms.forEach(term => {
        const lowerTerm = term.toLowerCase();
        const regex = new RegExp(`\\b${lowerTerm}\\b`, 'gi');
        improved = improved.replace(regex, term);
      });
      
      // Add periods at natural pauses if missing
      improved = improved.replace(/(\w)\s+([A-Z])/g, '$1. $2');
      
      return improved;
    };

    // Update the speech recognition result handler in startTranscription to use Cohere correction
    recognitionRef.current.onresult = (event) => {
      let currentInterimTranscript = '';
      let finalTranscript = '';
      let highestConfidence = 0;
      let bestAlternative = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        if (result.isFinal) {
          // Select the alternative with highest confidence if available
          if (result.length > 1) {
            for (let j = 0; j < result.length; j++) {
              if (result[j].confidence > highestConfidence) {
                highestConfidence = result[j].confidence;
                bestAlternative = result[j].transcript;
              }
            }
            finalTranscript += bestAlternative + ' ';
          } else {
            finalTranscript += result[0].transcript + ' ';
          }
        } else {
          currentInterimTranscript += result[0].transcript;
        }
      }

      // Update interim results immediately for real-time feedback
      setInterimTranscript(currentInterimTranscript);
      
      // Only update final transcript when we have final results
      if (finalTranscript) {
        // Store previous results for error detection
        previousResults.push(finalTranscript);
        if (previousResults.length > maxPreviousResults) {
          previousResults.shift();
        }
        
        // Improve text with capitalization and tech term corrections
        const improvedText = improveText(finalTranscript);
        
        // Generate a unique ID for this segment to track it
        const segmentId = Date.now().toString();
        const segmentToAdd = {
          id: segmentId,
          text: improvedText,
          corrected: false
        };
        
        // Add to transcript immediately for responsiveness
        setTranscript(prev => prev + improvedText);
        
        // Then send for Cohere correction in the background
        (async () => {
          try {
            const cohereImprovedText = await correctTranscriptionWithCohere(improvedText);
            
            // Only update if the correction changed something and doesn't contain boilerplate text
            if (cohereImprovedText !== improvedText && 
                !cohereImprovedText.toLowerCase().includes("hello, my name is") &&
                !cohereImprovedText.toLowerCase().includes("i would like me to proofread")) {
              
              // Replace the most recent addition with the corrected version
              setTranscript(prev => {
                // Find the last occurrence of the original text
                const lastIndex = prev.lastIndexOf(improvedText);
                
                // If found, replace it with the corrected version
                if (lastIndex !== -1) {
                  return prev.substring(0, lastIndex) + cohereImprovedText + prev.substring(lastIndex + improvedText.length);
                }
                
                // If the original text can't be found exactly (may happen due to state updates),
                // just append the corrected text
                return prev;
              });
            }
          } catch (error) {
            console.error("Error in Cohere correction process:", error);
          }
        })();
        
        setInterimTranscript('');
      }
    };

    recognitionRef.current.onend = () => {
      // Automatically restart recognition if we're still recording
      if (isRecording) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
          // Try again after a short delay
          setTimeout(() => {
            if (isRecording && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (innerError) {
                console.error('Failed to restart recognition after delay:', innerError);
              }
            }
          }, 1000);
        }
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      // Attempt to restart on error if still recording
      if (isRecording && event.error !== 'no-speech') {
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
              setTimeout(() => {
                recognitionRef.current?.start();
              }, 500);
            } catch (error) {
              console.error('Failed to restart recognition after error:', error);
            }
          }
        }, 1000);
      }
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
          }
        } catch (retryError) {
          console.error('Failed to start recognition on retry:', retryError);
        }
      }, 1000);
    }
  };

  const stopTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const startRecording = () => {
    if (!mediaStreamActive || !mediaStreamRef.current) {
      alert('Camera must be active to start recording.');
      return;
    }

    try {
      const options = { mimeType: 'video/webm' };
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, options);
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      setRecordedChunks([]);
      
      // Start speech recognition for transcription
      startTranscription();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      setIsRecording(false);
      
      // Create download URL after a brief delay to ensure all chunks are processed
      setTimeout(() => {
        if (recordedChunks.length) {
          const blob = new Blob(recordedChunks, {
            type: 'video/webm'
          });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
        }
      }, 500);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;
    
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `interview-recording-${new Date().toISOString()}.webm`;
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTranscript = () => {
    if (!transcript) return;
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (mediaStreamRef.current) {
      const videoTracks = mediaStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Function to send message to Ollama API
  const sendMessageToOllama = async (userMessage: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'my-interviewer',
          prompt: userMessage,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Ollama API');
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error connecting to Ollama API:', error);
      return "Sorry, I'm having trouble connecting to the interview AI. Please try again.";
    } finally {
      setIsLoading(false);
    }
  };

  // Function to send message to Gemini API
  const sendMessageToGemini = async (userMessage: string) => {
    setIsLoading(true);
    try {
      // Use the API key from .env.local file
      const apiKey = "AIzaSyBBdRxxc4x6D67mtlQVhCgesirvm5zGcJs";
      
      console.log("Sending request to Gemini API...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: userMessage }]
          }]
        }),
      });

      console.log("Gemini API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error response:", errorText);
        throw new Error(`Failed to get response from Gemini API: ${response.status}`);
      }

      const data = await response.json();
      console.log("Gemini API response data:", data);
      
      // Extract text from Gemini response
      if (data.candidates && data.candidates[0] && data.candidates[0].content && 
          data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      }
      
      throw new Error('Unexpected response format from Gemini API');
    } catch (error) {
      console.error('Error connecting to Gemini API:', error);
      return "Sorry, I'm having trouble connecting to Gemini AI. Please check the console for error details and ensure you've added a valid API key.";
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle sending a message to the selected AI
  const sendMessageToAI = async (userMessage: string) => {
    return useGeminiAI 
      ? sendMessageToGemini(userMessage)
      : sendMessageToOllama(userMessage);
  };

  // Completely rewritten handleNextQuestion function
  const handleNextQuestion = async () => {
    // If already processing a message, don't allow another process
    if (processingMessage) {
      return;
    }

    // Define technology keywords for detecting mentioned technologies
    const techKeywords = [
      'java', 'python', 'javascript', 'typescript', 'react', 'node', 'angular', 'vue', 
      'sql', 'nosql', 'mongodb', 'postgres', 'mysql', 'oracle', 'c#', 'c++', 'rust', 'go',
      'aws', 'azure', 'cloud', 'docker', 'kubernetes', 'microservices', 'spring', 'hibernate'
    ];

    // If we need the transcript but there's none, show an alert
    if (!responseSubmitted && currentQuestionIndex >= 0 && !transcript.trim() && !userResponse) {
      alert("Please start speaking to provide your response, or activate your microphone first.");
      return;
    }

    // If user has already submitted a response and seen feedback, go to next question
    if (responseSubmitted) {
      setResponseSubmitted(false);
      setAiResponseFeedback('');
      setShowFeedback(false);
      
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
      setProcessingMessage(true);
      setIsLoading(true);
      
      try {
        // For both Gemini and Ollama, generate a technical question based on previous responses
        // Gather all previous conversation for context
        const conversationContext = messages.map(msg => 
          `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`
        ).join("\n");
        
        if (useGeminiAI) {
          // Create a prompt that specifically requests a follow-up technical question for Gemini
          const technicalQuestionPrompt = `
I'm conducting a technical interview. The conversation so far:

${conversationContext}

Based on the candidate's responses, generate the NEXT technical question for this interview.

IMPORTANT REQUIREMENTS:
1. Focus ONLY on the specific programming languages, frameworks, or projects the candidate mentioned (Java, Python, SQL, etc.)
2. Ask a detailed technical question that tests their knowledge and experience
3. If they mentioned Java, ask about specific Java concepts like threading, collections, or OOP
4. If they mentioned databases, ask about schema design, normalization, or queries
5. Make sure the question is specific, challenging, and reveals technical depth
6. Don't repeat questions already asked
7. Each follow-up question should be different from previous ones

Return ONLY the next technical question with no additional text or explanation. Format as: "X. [Your specific technical question]" where X is the appropriate question number.`;

          // Get the next technical question from Gemini
          const nextQuestion = await sendMessageToGemini(technicalQuestionPrompt);
          
          // Add it to messages and update state
          setMessages(prev => {
            const newMessages = [...prev, { role: 'assistant' as const, content: nextQuestion }];
            return newMessages;
          });
        } else {
          // For Ollama, use an improved prompt that ensures relevance to mentioned technologies
          // Extract technologies mentioned by the candidate from previous responses
          let mentionedTechnologies = [];
          messages.forEach(msg => {
            if (msg.role === 'user') {
              const lowerContent = msg.content.toLowerCase();
              techKeywords.forEach(tech => {
                if (lowerContent.includes(tech) && !mentionedTechnologies.includes(tech)) {
                  mentionedTechnologies.push(tech);
                }
              });
            }
          });
          
          // If no technologies were detected, use a more general approach
          const focusArea = mentionedTechnologies.length > 0 
            ? `Focus specifically on: ${mentionedTechnologies.join(', ')}` 
            : "Ask a general technical question about programming fundamentals";
          
          const ollamaPrompt = `
You are conducting a technical interview. The conversation so far:

${conversationContext}

${focusArea}

Generate the next technical question for this interview. 
DO NOT ask about topics the candidate hasn't mentioned.
For example, if they only talked about Java, don't ask about databases or web development.
Make the question specific, challenging, and related to what the candidate has mentioned.
Format as question #${currentQuestionIndex + 2} in the sequence.

Return ONLY the question without explanations or additional text.`;

          // Send the enhanced prompt to Ollama
          const nextQuestion = await sendMessageToOllama(ollamaPrompt);
          
          const formattedQuestion = nextQuestion.startsWith(`${currentQuestionIndex + 2}.`) 
            ? nextQuestion 
            : `${currentQuestionIndex + 2}. ${nextQuestion}`;
          
          // Add the next question
          setMessages(prev => {
            const newMessages = [...prev, { role: 'assistant' as const, content: formattedQuestion }];
            return newMessages;
          });
        }
        
        // Explicitly set the view index to show the new question
        setTimeout(() => {
          setCurrentViewIndex(messages.length);
        }, 100);
        
      } catch (error) {
        console.error("Error generating next question:", error);
        // Fallback question
        const fallbackQuestion = `${currentQuestionIndex + 2}. Tell me more about your technical experience with one of the technologies you mentioned.`;
        
        setMessages(prev => {
          const newMessages = [...prev, { role: 'assistant' as const, content: fallbackQuestion }];
          return newMessages;
        });
        
        // Explicitly set the view index to show the fallback question
        setTimeout(() => {
          setCurrentViewIndex(messages.length);
        }, 100);
      } finally {
        setIsLoading(false);
        setProcessingMessage(false);
      }
      
      // Clear transcript after proceeding to next question
      setTranscript('');
      setUserResponse('');
      return;
    }

    // Handle user response
    if (currentQuestionIndex >= 0 && !responseSubmitted) {
      setProcessingMessage(true);
      setIsLoading(true);
      
      try {
        // Get the response text (either from userResponse or transcript)
        const userResponseText = userResponse || transcript.trim();
        
        // Clear variables to prevent duplicate processing
        setUserResponse('');
        setTranscript('');
        
        // Add the user's message to the chat
        const updatedMessages = [...messages, { role: 'user' as const, content: userResponseText }];
        setMessages(updatedMessages);
        
        // Get AI feedback on the response
        const feedbackPrompt = `The candidate has answered the following interview question:

Question: ${updatedMessages[updatedMessages.length - 2].content}

Candidate's response: "${userResponseText}"

As an expert interviewer, provide concise and helpful feedback on this response. Your feedback should:
1. Note 1-2 good points about the answer
2. Suggest 1-2 specific improvements or additions
3. Provide a brief sample improved response (2-3 sentences)

Keep your feedback brief and to the point - no more than 4-5 short paragraphs total.
Be specific, constructive, and actionable in your feedback.`;

        const feedbackResponse = await sendMessageToAI(feedbackPrompt);
        setAiResponseFeedback(feedbackResponse);
        setResponseSubmitted(true);
        setShowFeedback(false);
        
        // For the first question only, also generate a completely new set of technical questions
        if (currentQuestionIndex === 0) {
          // REQUEST AI TO ANALYZE THE INTRODUCTION AND CREATE TAILORED QUESTIONS
          const analysisPrompt = `The candidate has introduced themselves as follows:
"${userResponseText}"

You are an experienced technical interviewer. I need you to generate follow-up questions that specifically focus on the technologies, skills, and projects the candidate mentioned.

IMPORTANT INSTRUCTIONS:
1. ONLY ask about technologies and skills explicitly mentioned by the candidate
2. If they mentioned Java, create Java-specific questions about core concepts, JVM, collections, etc.
3. If they mentioned databases, create database-specific questions
4. NEVER introduce topics they didn't mention (for example: if they only mentioned Java, don't ask about Python or web development)
5. Create technical questions that directly relate to these specific skills
6. Ask detailed questions about implementation, challenges, and technical decisions
7. Format each question as a JSON object with "question" and "feedback" fields

Return ONLY a valid JSON array of question objects in this format:
[
  {
    "question": "Your technical question about a specific skill/project they mentioned",
    "feedback": "Feedback about how to answer well, focusing on technical depth"
  },
  ...more questions
]

Generate at least 5 questions. Ensure every question is directly related to what the candidate mentioned. DO NOT include any explanatory text before or after the JSON.`;

          try {
            const response = await sendMessageToAI(analysisPrompt);
            
            // Try to parse the response as JSON
            try {
              // First clean any potential markdown formatting
              const cleanedResponse = response.replace(/```json|```/g, '').trim();
              const newQuestions = JSON.parse(cleanedResponse);
              
              if (Array.isArray(newQuestions) && newQuestions.length > 0) {
                // Add the new questions to the existing first question
                setQuestions(prev => [...prev, ...newQuestions]);
              } else {
                throw new Error("Invalid question format");
              }
            } catch (jsonError) {
              console.error("Failed to parse questions:", jsonError);
              console.log("Raw response:", response);
              
              // Create generic questions as fallback that are still relevant to what was mentioned
              // Extract potential tech keywords from user response
              const userResponseLower = userResponseText.toLowerCase();
              const relevantTopics = techKeywords.filter(tech => userResponseLower.includes(tech));
              
              // Create generic but relevant fallback questions
              const fallbackQuestions = relevantTopics.length > 0 ? 
                [
                  { question: `Tell me more about your experience with ${relevantTopics.join(', ')}.`, feedback: "Focus on relevant technical details and your hands-on experience." },
                  { question: `What are some challenges you've faced when working with ${relevantTopics[0]}?`, feedback: "Focus on technical challenges and how you overcame them." },
                  { question: `Explain your technical expertise in ${relevantTopics[0]}.`, feedback: "Demonstrate depth of knowledge and understanding of core concepts." },
                  { question: "How do you approach problem-solving in your technical work?", feedback: "Show your methodology and critical thinking process." },
                  { question: `How do you stay updated with the latest developments in ${relevantTopics[0]}?`, feedback: "Show your commitment to continuous learning." }
                ] :
                [
                  { question: "Can you tell me more about your technical background and skills?", feedback: "Focus on relevant technologies, programming languages, and tools you're proficient with." },
                  { question: "Tell me about your most challenging project.", feedback: "Focus on technical challenges and how you overcame them." },
                  { question: "How do you approach problem-solving?", feedback: "Show your methodology and critical thinking process." },
                  { question: "What development methodologies are you familiar with?", feedback: "Demonstrate your understanding of software development processes." },
                  { question: "Where do you see yourself technically in 5 years?", feedback: "Show your growth mindset and career aspirations." }
                ];
              
              setQuestions(prev => [...prev, ...fallbackQuestions]);
            }
          } catch (error) {
            console.error("Error generating questions:", error);
            // Create simple fallback questions
            setQuestions(prev => [
              ...prev,
              { question: "Tell me more about your technical skills and projects.", feedback: "Focus on technical details and your contributions." },
              { question: "What has been your most challenging technical problem?", feedback: "Explain the problem, your approach, and the solution." },
              { question: "How do you keep your skills current?", feedback: "Mention specific learning resources and methods." }
            ]);
          }
        }
      } catch (error) {
        console.error("Error processing response:", error);
        setAiResponseFeedback("I couldn't generate specific feedback at this time. Please try again.");
      } finally {
        setIsLoading(false);
        setProcessingMessage(false);
      }
    }
  };

  // Function to toggle feedback
  const toggleFeedback = () => {
    setShowFeedback(prev => !prev);
  };

  // Modify initiate interview function
  const initiateInterview = async (useGemini = useGeminiAI) => {
    setIsLoading(true);
    
    // Reset interview state
    setCurrentQuestionIndex(0);
    setShowFeedback(false);
    setUserResponse('');
    setResponseSubmitted(false);
    setAiResponseFeedback('');
    setCurrentViewIndex(0);
    
    // Set up initial question
    const initialQuestion = useGemini
      ? "Tell me about yourself, focusing on your technical skills, programming languages you know, and projects you've worked on. Please mention specific technologies and details about your most significant projects."
      : "Tell me about yourself";
      
    setQuestions([
      { 
        question: initialQuestion, 
        feedback: "Your introduction should highlight your technical skills, programming languages, frameworks, specific projects, and your role in those projects."
      }
    ]);
    
    // Clear messages for new interview
    setMessages([]);
    
    // Add first question to chat
    const firstQuestion = `1. ${initialQuestion}`;
    setMessages([{ role: 'assistant', content: firstQuestion }]);
    
    setIsLoading(false);
  };

  // Function to handle sending a message
  const handleSendMessage = async () => {
    // Use the handleNextQuestion function for the interview format
    handleNextQuestion();
  };

  // Toggle between AI models
  const toggleAIModel = () => {
    setUseGeminiAI(prev => !prev);
    
    // Reset messages and start a new interview with the selected AI
    setMessages([]);
    setIsLoading(true);
    
    // Initiate new interview with the toggled AI
    initiateInterview(!useGeminiAI);
  };

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Start with an initial greeting from the interviewer when component mounts
  useEffect(() => {
    initiateInterview();
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup: Stop recording when component unmounts
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [downloadUrl]);

  // Function to activate camera
  const activateCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      mediaStreamRef.current = stream;
      
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
      
      setMediaStreamActive(true);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Failed to access camera and microphone. Please ensure they are connected and permissions are granted.');
    }
  };

  // Function to deactivate camera
  const deactivateCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      
      mediaStreamRef.current = null;
      
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null;
      }
      
      setMediaStreamActive(false);
    }
  };

  // Function to start editing the transcript
  const startEditingTranscript = () => {
    setEditableTranscript(transcript);
    setIsEditingTranscript(true);
    // Focus on the textarea after it renders
    setTimeout(() => {
      if (editTranscriptRef.current) {
        editTranscriptRef.current.focus();
      }
    }, 100);
  };

  // Function to save edited transcript
  const saveEditedTranscript = () => {
    setTranscript(editableTranscript);
    setIsEditingTranscript(false);
  };

  // Function to cancel editing
  const cancelEditingTranscript = () => {
    setIsEditingTranscript(false);
  };

  // Add function to navigate through messages
  const navigateMessages = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentViewIndex < messages.length - 2) {
      setCurrentViewIndex(prevIndex => prevIndex + 2); // Move by pairs (Q&A)
    } else if (direction === 'prev' && currentViewIndex > 0) {
      setCurrentViewIndex(prevIndex => Math.max(0, prevIndex - 2)); // Move by pairs, don't go below 0
    }
  };

  // Function to start recording the entire screen with audio
  const startScreenRecording = async () => {
    try {
      // Play audio notification for recording started
      if (startRecordingAudioRef.current) {
        startRecordingAudioRef.current.play().catch(error => {
          console.error('Error playing start recording audio:', error);
        });
      }

      // Get screen capture stream with compatible constraints
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // Simplified to avoid TypeScript errors
        audio: true
      });
      
      // If we have a microphone stream, combine it with the screen stream
      if (mediaStreamRef.current) {
        const audioTracks = mediaStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          // Add the audio track from the microphone to the screen stream
          screenStream.addTrack(audioTracks[0]);
        }
      }
      
      // Create and start the media recorder
      const options = { mimeType: 'video/webm' };
      const mediaRecorder = new MediaRecorder(screenStream, options);
      
      screenMediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsScreenRecording(true);
      setScreenRecordedChunks([]);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setScreenRecordedChunks((prev) => [...prev, event.data]);
        }
      };
      
      // Add event listener for when the user stops sharing
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenRecording();
      };
    } catch (error) {
      console.error('Error starting screen recording:', error);
      alert('Failed to start screen recording. Please ensure you grant screen sharing permissions.');
    }
  };

  // Function to stop screen recording
  const stopScreenRecording = () => {
    if (screenMediaRecorderRef.current && isScreenRecording) {
      // Play audio notification for recording stopped
      if (stopRecordingAudioRef.current) {
        stopRecordingAudioRef.current.play().catch(error => {
          console.error('Error playing stop recording audio:', error);
        });
      }

      // Set up the ondataavailable event to store recording data
      screenMediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          const blob = new Blob([event.data], {
            type: 'video/webm'
          });
          const url = URL.createObjectURL(blob);
          setScreenDownloadUrl(url);
        }
      };
      
      // Stop the recording
      screenMediaRecorderRef.current.stop();
      setIsScreenRecording(false);
    }
  };

  // Function to download the screen recording
  const downloadScreenRecording = () => {
    if (screenRecordedChunks.length === 0) return;
    
    const blob = new Blob(screenRecordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `full-interview-recording-${new Date().toISOString()}.webm`;
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Update cleanup to include screen recording
  useEffect(() => {
    return () => {
      // Cleanup: Stop recordings when component unmounts
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (screenMediaRecorderRef.current && screenMediaRecorderRef.current.state !== 'inactive') {
        screenMediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      if (screenDownloadUrl) {
        URL.revokeObjectURL(screenDownloadUrl);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [downloadUrl, screenDownloadUrl]);

  // Also update the useEffect to ensure currentViewIndex stays up to date with new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    
    // Update view index to show the latest message when new messages are added
    if (messages.length > 0 && !isLoading) {
      // If we're on the last view or within one pair of it, auto-update to the latest
      if (currentViewIndex >= messages.length - 4) {
        setCurrentViewIndex(Math.max(0, messages.length - 2));
      }
    }
  }, [messages, isLoading]);

  // Function to toggle notes popup
  const toggleNotesPopup = () => {
    setShowNotesPopup(prev => !prev);
    
    // We'll initialize the canvas in a useEffect instead
  };

  // Update the state change for activeNoteTool to initialize canvas when pen is selected
  const setActiveTool = (tool: 'pen' | 'eraser' | 'keyboard') => {
    setActiveNoteTool(tool);
    
    // If switching to pen, make sure canvas is initialized
    if (tool === 'pen') {
      setTimeout(() => {
        if (canvasRef.current) {
          const context = canvasRef.current.getContext('2d');
          if (context) {
            context.lineWidth = 3;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#000000';
            setDrawingContext(context);
          }
        }
      }, 50); // Short timeout to ensure the canvas is in the DOM
    }
  };

  // Add useEffect to initialize the canvas when the popup is opened
  useEffect(() => {
    if (showNotesPopup && activeNoteTool === 'pen' && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#000000';
        setDrawingContext(context);
      }
    }
  }, [showNotesPopup, activeNoteTool]);

  // Improve the drawing functions to better handle coordinates
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeNoteTool !== 'pen') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set the context again just to be sure
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    setDrawingContext(ctx);
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    
    // Prevent default to avoid issues
    e.preventDefault();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeNoteTool !== 'pen') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Prevent default to avoid issues
    e.preventDefault();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.closePath();
      }
    }
    setIsDrawing(false);
  };

  const eraseCanvas = () => {
    if (canvasRef.current && drawingContext) {
      drawingContext.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100 py-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center p-1 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Face to Face Interview</h1>
          </div>
          
          {/* Add Notes button here */}
          <div className="flex gap-2">
            {/* Move Coding Round button here */}
            <Link
              href="/coding-round"
              className="flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
              Coding Round
            </Link>
            
            <button
              onClick={toggleNotesPopup}
              className="flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mr-2"
              title="Open notes"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 003 3h15a3 3 0 01-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125zM12 9.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H12zm-.75-2.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H12a.75.75 0 01-.75-.75zM6 12.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5H6zm-.75 3.75a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zM6 6.75a.75.75 0 00-.75.75v.75c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-.75a.75.75 0 00-.75-.75H6z" clipRule="evenodd" />
              </svg>
              Notes
            </button>
            
            {!isScreenRecording ? (
              <button
                onClick={startScreenRecording}
                className="flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-violet-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                title="Record entire interview"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                </svg>
                Record Interview
              </button>
            ) : (
              <button
                onClick={stopScreenRecording}
                className="flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-medium rounded-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Stop recording"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                </svg>
                Stop Recording
              </button>
            )}
            
            {screenDownloadUrl && (
              <a
                href={screenDownloadUrl}
                download={`full-interview-${new Date().toISOString()}.webm`}
                className="flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-teal-700 hover:to-emerald-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                title="Download full interview recording"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
                Download Recording
              </a>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Video Section */}
          <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200 hover:shadow-xl transition-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center border-b border-gray-100 pb-2">
              <span className="bg-indigo-100 rounded-full w-6 h-6 flex items-center justify-center mr-2 text-indigo-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </span>
              User
            </h2>
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg flex items-center justify-center overflow-hidden relative border border-slate-200 shadow-inner" style={{height: '340px'}}>
              {!mediaStreamActive && (
                <div className="text-gray-500 font-medium flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-400 mb-2 opacity-60">
                    <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                  </svg>
                  Camera not active
                </div>
              )}
              <video 
                ref={userVideoRef}
                autoPlay 
                muted 
                playsInline
                className={`w-full h-full object-cover ${!mediaStreamActive ? 'hidden' : ''}`}
              ></video>
              
              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-2 right-2 flex items-center bg-red-500 text-white px-2 py-1 rounded-full text-sm shadow-md animate-pulse">
                  <span className="mr-1 h-2 w-2 rounded-full bg-white"></span>
                  Recording
                </div>
              )}
            </div>
            
            <div className="mt-3 flex justify-center">
              {!mediaStreamActive ? (
                <button
                  onClick={activateCamera}
                  className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <VideoCameraIcon className="w-4 h-4" />
                  Activate Camera
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Start recording"
                    >
                      <MicrophoneIcon className="w-4 h-4" />
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-medium rounded-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      title="Stop recording"
                    >
                      <NoSymbolIcon className="w-4 h-4" />
                      Stop Recording
                    </button>
                  )}
                  
                  <button
                    onClick={deactivateCamera}
                    className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-gray-600 to-slate-600 text-white text-sm font-medium rounded-lg hover:from-gray-700 hover:to-slate-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                    title="Turn off camera"
                  >
                    <XCircleIcon className="w-4 h-4" />
                    Turn Off Camera
                  </button>
                  
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={`interview-${new Date().toISOString()}.webm`}
                      className="flex items-center justify-center gap-2 py-1.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      title="Download recording"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Download Video
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Interviewer Section */}
          <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <span className="bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center mr-2 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
                  </svg>
                </span>
                Interviewer
              </h2>
              <button
                onClick={toggleAIModel}
                className={`flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-2
                  ${useGeminiAI 
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700 focus:ring-purple-500' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500'}`}
              >
                {useGeminiAI ? 'Using: Gemini' : 'Using: Ollama'}
              </button>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg flex flex-col overflow-hidden border border-slate-200 shadow-inner" style={{height: '340px'}}>
              {/* Chat messages container */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 text-sm"
              >
                {messages.length > 0 && (
                  <>
                    {/* Show only current question and answer pair */}
                    {currentViewIndex < messages.length && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-3 shadow-sm">
                        <p className="text-gray-800 font-medium">
                          {messages[currentViewIndex].content}
                        </p>
                      </div>
                    )}
                    
                    {/* Show user response if available */}
                    {currentViewIndex + 1 < messages.length && messages[currentViewIndex + 1].role === 'user' && (
                      <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
                        <p className="text-gray-700">
                          {messages[currentViewIndex + 1].content}
                        </p>
                        
                        {/* Show feedback button if it's the latest response */}
                        {currentViewIndex + 1 === messages.length - 1 && aiResponseFeedback && (
                          <>
                            <button 
                              onClick={toggleFeedback}
                              className="mt-2 text-blue-500 hover:text-blue-700 transition-colors flex items-center text-xs"
                              title="Toggle feedback"
                            >
                              {showFeedback ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1">
                                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-.53 14.03a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72V8.25a.75.75 0 00-1.5 0v5.69l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3z" clipRule="evenodd" />
                                  </svg>
                                  Hide AI feedback
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1">
                                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.53 5.47a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72v5.69a.75.75 0 001.5 0v-5.69l1.72 1.72a.75.75 0 101.06-1.06l-3-3z" clipRule="evenodd" />
                                  </svg>
                                  Show AI feedback
                                </>
                              )}
                            </button>
                            
                            {/* AI feedback when toggle is on */}
                            {showFeedback && (
                              <div className="mt-3 bg-gradient-to-r from-amber-50 to-yellow-50 text-gray-800 rounded-lg p-3 border border-amber-100 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">AI Feedback:</p>
                                <p className="text-sm">{aiResponseFeedback}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Navigation indicators */}
                    <div className="flex items-center justify-center mt-2 text-xs text-gray-500">
                      <span>Question {Math.floor(currentViewIndex / 2) + 1} of {Math.ceil(messages.length / 2)}</span>
                    </div>
                  </>
                )}
                
                {isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Navigation and Next buttons */}
              <div className="bg-white border-t border-gray-200 p-2 flex justify-between">
                {/* Navigation buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateMessages('prev')}
                    disabled={currentViewIndex <= 0 || isLoading}
                    className="bg-gray-100 text-gray-600 px-3 py-2 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-all font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigateMessages('next')}
                    disabled={(currentViewIndex >= messages.length - 2) || isLoading}
                    className="bg-gray-100 text-gray-600 px-3 py-2 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-all font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                {/* Next button (only show if viewing the latest question) */}
                {currentViewIndex >= messages.length - 2 && (
                  <button
                    onClick={() => {
                      handleNextQuestion();
                      if (responseSubmitted) {
                        // Force the view to update to the latest after a short delay
                        setTimeout(() => {
                          setCurrentViewIndex(messages.length);
                        }, 200);
                      }
                    }}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all font-medium"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing
                      </div>
                    ) : (
                      "NEXT"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Transcription Box */}
        <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200 mt-4 hover:shadow-xl transition-shadow">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <span className="bg-amber-100 rounded-full w-6 h-6 flex items-center justify-center mr-2 text-amber-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                </svg>
              </span>
              Transcription
            </h2>
            <div className="flex gap-2">
              {!isEditingTranscript && transcript && (
                <button
                  onClick={startEditingTranscript}
                  className="flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  title="Edit transcription"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                    <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
                  </svg>
                  Edit
                </button>
              )}
              {isEditingTranscript ? (
                <>
                  <button
                    onClick={saveEditedTranscript}
                    className="flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Save changes"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72V8.25a.75.75 0 00-1.5 0v5.69l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3z" clipRule="evenodd" />
                    </svg>
                    Save
                  </button>
                  <button
                    onClick={cancelEditingTranscript}
                    className="flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-sm font-medium bg-gradient-to-r from-gray-500 to-slate-500 text-white hover:from-gray-600 hover:to-slate-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                    title="Cancel editing"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (transcript.trim() && !processingMessage) {
                        // Set as user response and trigger processing
                        setUserResponse(transcript);
                        handleNextQuestion();
                      }
                    }}
                    disabled={processingMessage || isLoading}
                    className="flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    title="Send transcript to interviewer"
                  >
                    Submit Answer
                  </button>
                  {transcript && !isRecording && (
                    <button
                      onClick={downloadTranscript}
                      className="flex items-center justify-center gap-2 py-1 px-3 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Download transcription"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Download Transcript
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="overflow-y-auto bg-gradient-to-br from-slate-50 to-gray-100 rounded-lg p-3 font-mono text-sm border border-slate-200 shadow-inner" style={{height: '150px'}}>
            {isEditingTranscript ? (
              <textarea
                ref={editTranscriptRef}
                value={editableTranscript}
                onChange={(e) => setEditableTranscript(e.target.value)}
                className="w-full h-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none font-mono text-sm"
                placeholder="Edit your transcription here..."
              />
            ) : (
              <>
                {transcript}
                <span className="text-gray-500">{interimTranscript}</span>
                {!transcript && !interimTranscript && !isRecording && 
                  <span className="text-gray-500 italic">Transcription will appear here when you start speaking...</span>}
              </>
            )}
          </div>
        </div>
      </div>
      {/* Audio notifications for recording */}
      <audio
        ref={startRecordingAudioRef}
        src="/pic/recordstarted.mp3"
        preload="auto"
      ></audio>
      <audio
        ref={stopRecordingAudioRef}
        src="/pic/recordstopped.mp3"
        preload="auto"
      ></audio>
      
      {/* Notes Popup */}
      {showNotesPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Interview Notes</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTool('pen')}
                  className={`p-2 rounded-lg ${activeNoteTool === 'pen' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Draw with pen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setActiveTool('eraser');
                    eraseCanvas();
                  }}
                  className={`p-2 rounded-lg ${activeNoteTool === 'eraser' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Erase drawings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setActiveTool('keyboard')}
                  className={`p-2 rounded-lg ${activeNoteTool === 'keyboard' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                  title="Type notes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M2.25 4.125c0-1.036.84-1.875 1.875-1.875h16.5c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875h-16.5A1.875 1.875 0 012.25 16.875V4.125zM4.5 12.75a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15zm0-3.75a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15zm0-3.75a.75.75 0 000 1.5h15a.75.75 0 000-1.5h-15z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={toggleNotesPopup}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  title="Close notes"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4">
              {activeNoteTool === 'keyboard' ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-80 p-3 border border-gray-300 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type your interview notes here..."
                ></textarea>
              ) : (
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={400}
                  className="w-full h-80 border border-gray-300 rounded-lg shadow-inner cursor-crosshair bg-white"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                ></canvas>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  // Save notes logic could be added here
                  // For now just close the popup
                  toggleNotesPopup();
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 