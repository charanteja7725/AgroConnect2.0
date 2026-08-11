import { useEffect, useState, useCallback } from "react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant.js";

const VoiceSearch = ({ onSearch, placeholder = "Search products..." }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
  } = useVoiceAssistant();

  // When voice stops and we have a transcript, update search term and trigger search
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      const finalText = transcript.trim();
      setSearchTerm(finalText);
      onSearch(finalText);
    }
  }, [isListening, transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceSearch = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      clearTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, clearTranscript]);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearch(searchTerm);
    }
  };

  // Reflect interim transcript in the input while listening
  useEffect(() => {
    if (isListening && transcript) {
      setSearchTerm(transcript);
    }
  }, [isListening, transcript]);

  return (
    <div className="voice-search-container" style={{ width: "100%" }}>
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="search-input"
          aria-label="Search"
        />

        <button
          className={`voice-btn${isListening ? " listening" : ""}`}
          onClick={handleVoiceSearch}
          title={isListening ? "Stop listening" : "Start voice search"}
          aria-label={isListening ? "Stop voice search" : "Start voice search"}
          type="button"
        >
          {isListening ? "⏹" : "🎤"}
        </button>
      </div>

      {/* Status indicators */}
      {isListening && (
        <p className="voice-transcript" style={{ color: "#16a34a", fontSize: "12px", marginTop: "4px" }}>
          🎙 Listening... {transcript && `"${transcript}"`}
        </p>
      )}
      {!isListening && error && (
        <p className="voice-error">{error}</p>
      )}
    </div>
  );
};

export default VoiceSearch;
