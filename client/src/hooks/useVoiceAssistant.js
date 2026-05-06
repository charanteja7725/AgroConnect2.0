import { useCallback, useEffect, useRef, useState } from "react";

export const useVoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechSynthesis = window.speechSynthesis;

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Indian English

    recognition.onstart = () => {
      setIsListening(true);
      setError("");
      setTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + transcriptSegment + " ");
        } else {
          interim += transcriptSegment;
        }
      }
      if (interim) setTranscript((prev) => prev.split(" ").slice(0, -1).join(" ") + " " + interim);
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [SpeechRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  const speak = useCallback(
    (text) => {
      if (!SpeechSynthesis) {
        setError("Text-to-speech not supported in this browser");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setError("Speech synthesis error");

      SpeechSynthesis.cancel();
      SpeechSynthesis.speak(utterance);
    },
    [SpeechSynthesis]
  );

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    clearTranscript,
  };
};
