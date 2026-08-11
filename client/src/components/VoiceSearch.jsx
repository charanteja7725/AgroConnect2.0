import { useEffect, useState } from "react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant.js";

const VoiceSearch = ({ onSearch, placeholder = "Search products..." }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { isListening, transcript, error, startListening, stopListening, clearTranscript } =
    useVoiceAssistant();

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      const timer = setTimeout(() => {
        setSearchTerm(transcript);
        onSearch(transcript);
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isListening, transcript, onSearch]);

  const handleVoiceSearch = () => {
    if (isListening) {
      stopListening();
    } else {
      clearTranscript();
      startListening();
    }
  };

  const handleTextSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  return (
    <div className="voice-search-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleTextSearch}
          className="search-input"
        />
        <button
          className={`voice-btn ${isListening ? "listening" : ""}`}
          onClick={handleVoiceSearch}
          title={isListening ? "Stop listening" : "Start voice search"}
        >
          {isListening ? "🎤⏹️" : "🎤"}
        </button>
      </div>
      {error && <p className="voice-error">{error}</p>}
      {transcript && <p className="voice-transcript">Heard: {transcript}</p>}
    </div>
  );
};

export default VoiceSearch;
