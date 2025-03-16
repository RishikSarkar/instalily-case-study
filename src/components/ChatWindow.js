import React, { useState, useEffect, useRef } from "react";
import "./ChatWindow.css";
import { getAIMessage } from "../api/api";
import { marked } from "marked";
import PartsContainer from "./PartsContainer";

function ChatWindow() {

  const defaultMessage = [{
    role: "assistant",
    content: "Hi there! I'm your PartSelect assistant. I can help you find refrigerator and dishwasher parts, check compatibility, assist with installations, and support your purchase. How can I help you today?"
  }];

  const [messages, setMessages] = useState(defaultMessage);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
      scrollToBottom();
  }, [messages, loading]);

  // Loading indicator component
  const LoadingIndicator = () => (
    <div className="assistant-message-container">
      <div className="message assistant-message">
        <div className="loading-dots">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    </div>
  );

  const handleSend = async (input) => {
    if (input.trim() !== "") {
      // Update state with new user message
      const newUserMessage = { role: "user", content: input };
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      try {
        // Call API with full conversation history for context
        const newMessage = await getAIMessage(input, updatedMessages);
        setMessages(prevMessages => [...prevMessages, newMessage]);
      } catch (error) {
        console.error('Error in chat:', error);
        // Show error message
        setMessages(prevMessages => [
          ...prevMessages,
          {
            role: "assistant",
            content: "Sorry, there was an error processing your request. Please try again."
          }
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
      <div className="messages-container">
          {messages.map((message, index) => (
              <div key={index} className={`${message.role}-message-container`}>
                  {message.content && (
                      <div className={`message ${message.role}-message`}>
                          <div dangerouslySetInnerHTML={{__html: marked(message.content).replace(/<p>|<\/p>/g, "")}}></div>
                      </div>
                  )}
                  
                  {/* Display parts if this is an assistant message with parts */}
                  {message.role === "assistant" && message.parts && message.parts.length > 0 && (
                    <PartsContainer parts={message.parts} />
                  )}
              </div>
          ))}
          
          {/* Show loading indicator while waiting for response */}
          {loading && <LoadingIndicator />}
          
          <div ref={messagesEndRef} />
          
          <div className="input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about refrigerator or dishwasher parts..."
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSend(input);
                  e.preventDefault();
                }
              }}
              disabled={loading}
              rows="3"
            />
            <button 
              className="send-button" 
              onClick={() => handleSend(input)}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
      </div>
  );
}

export default ChatWindow;
