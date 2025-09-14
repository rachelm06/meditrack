import React, { useState, useEffect, useRef } from 'react';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const AIAgent = ({ isOpen, onToggle, className = '' }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        type: 'ai',
        content: `🏥 **Healthcare Supply AI Assistant**

I can help you with:

**🚨 Emergency Analysis**: "What items need emergency purchases?"
**📊 Usage Trends**: "Why are my N95 mask costs increasing?"
**💰 Budget Impact**: "What's driving my waste costs?"
**🔮 Predictions**: "Which items will run out first?"
**📈 Trend Analysis**: "What trends suggest we need more supplies?"

Try asking me anything about your inventory, supply chain, or predictions!`,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        response_type: 'welcome'
      }]);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai_judge/ask_question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: inputMessage.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Simulate typing delay for better UX
        setTimeout(() => {
          const aiMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: data.response,
            confidence: data.confidence,
            response_type: data.response_type,
            actionable: data.actionable,
            timestamp: data.timestamp
          };

          setMessages(prev => [...prev, aiMessage]);
          setIsTyping(false);
        }, 800);
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setTimeout(() => {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: `❌ **Error**: I'm having trouble processing your request right now. Please try again in a moment.

**Tip**: Make sure the backend server is running and accessible.`,
          confidence: 0.1,
          response_type: 'error',
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (message) => {
    if (message.type === 'user') return null;

    if (message.response_type === 'urgency_analysis' && message.actionable) {
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    } else if (message.response_type === 'error') {
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    } else if (message.actionable) {
      return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
    } else {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatMessage = (content) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/• (.*?)(?=\n|$)/g, '• <span>$1</span>')
      .replace(/\n/g, '<br/>');
  };

  const suggestedQuestions = [
    "What items need emergency purchases?",
    "Why are my costs increasing?",
    "Which items will run out first?",
    "What trends suggest higher demand?",
    "Is this an emergency situation?"
  ];

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <div className="relative">
          {/* Enhanced pulsing ring animation */}
          <div className="absolute -inset-2 bg-blue-400 rounded-full animate-ping opacity-75"></div>
          <div className="absolute -inset-1 bg-blue-500 rounded-full animate-pulse opacity-50"></div>

          {/* Glowing effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full blur-sm animate-pulse"></div>

          <button
            onClick={onToggle}
            className="relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-full shadow-xl transition-all hover:scale-110 flex items-center space-x-3 group animate-bounce"
            style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}
            title="🤖 Ask AI Assistant about emergency purchases, trends, and supply chain"
          >
            <ChatBubbleLeftRightIcon className="w-7 h-7" />
            <span className="text-base font-bold">Ask AI Assistant</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
          </button>

          {/* Enhanced tooltip with call-to-action */}
          <div className="absolute bottom-full right-0 mb-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-95 whitespace-nowrap animate-pulse">
            <div className="font-semibold">🚨 Ask AI about emergencies!</div>
            <div className="text-xs mt-1">Get instant supply chain insights</div>
          </div>

          {/* Additional floating badge */}
          <div className="absolute -top-3 -left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce shadow-lg">
            NEW
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 h-[32rem] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-900">AI Supply Chain Assistant</h3>
        </div>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.type === 'ai' && (
                <div className="flex items-center space-x-2 mb-2">
                  {getMessageIcon(message)}
                  <span className="text-xs font-medium">
                    AI Judge
                    {message.confidence && (
                      <span className={`ml-2 ${getConfidenceColor(message.confidence)}`}>
                        ({Math.round(message.confidence * 100)}% confidence)
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: message.type === 'ai' ? formatMessage(message.content) : message.content
                }}
              />
              {message.actionable && message.type === 'ai' && (
                <div className="mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                  ⚡ Action Required
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (show when few messages) */}
      {messages.length <= 2 && !isTyping && (
        <div className="px-4 pb-2">
          <div className="text-xs text-gray-500 mb-2">Try asking:</div>
          <div className="flex flex-wrap gap-1">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setInputMessage(question);
                  inputRef.current?.focus();
                }}
                className="text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded border text-gray-600 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your supply chain, emergencies, trends..."
            className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows="1"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <ClockIcon className="w-5 h-5 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAgent;