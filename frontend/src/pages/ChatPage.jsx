// pages/ChatPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // <-- 1. IMPORT THE GFM PLUGIN
import { Send, FileText, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

function ChatPage() {
  // ... (keep all your existing state and functions: useState, useEffect, handleFileChange, etc.)
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isRagMode, setIsRagMode] = useState(false);
  const [studyProcessed, setStudyProcessed] = useState(false);
  const chatEndRef = useRef(null);
  const studyTaskRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Handle study mode when task details are passed from other pages
  useEffect(() => {
    const studyTask = location.state?.studyTask;
    
    // Check if we have a study task and it's different from the last processed one
    if (studyTask && 
        !studyProcessed && 
        JSON.stringify(studyTask) !== JSON.stringify(studyTaskRef.current)) {
      
      studyTaskRef.current = studyTask; // Store current task
      const { task, scheduleName } = studyTask;
      
      setIsRagMode(false); // Use general chat mode for studying
      setChatHistory([]);
      setStudyProcessed(true); // Prevent duplicate processing
      
      // Create a clean study prompt with essential task details
      const studyPrompt = `I want to study and learn about: "${task.task_title || task.name}"

${task.task_description || task.description ? `**Topic Details:** ${task.task_description || task.description}` : ''}
**From:** ${scheduleName || 'My Studies'}

Please teach me about this topic with clear explanations and practical examples.`;

      setQuestion(studyPrompt);
      
      // Auto-send the study question with a longer delay
      setTimeout(() => {
        if (!isLoading) { // Additional check
          handleStudyQuestion(studyPrompt);
        }
      }, 1000);
      
      // Clear the location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state, studyProcessed, isLoading]);

  const handleStudyQuestion = async (studyPrompt) => {
    // Prevent duplicate sends with multiple checks
    if (isLoading) {
      console.log('🛑 Study question blocked - already loading');
      return;
    }
    
    // Check if this exact prompt was already sent
    const lastMessage = chatHistory[chatHistory.length - 1];
    if (lastMessage?.sender === 'user' && lastMessage?.text === studyPrompt) {
      console.log('🛑 Study question blocked - duplicate prompt');
      return;
    }
    
    console.log('🚀 Sending study question...');
    const userMessage = { sender: 'user', text: studyPrompt };
    setIsLoading(true);
    setChatHistory((prev) => [...prev, userMessage]);
    setQuestion('');
    
    try {
      console.log(`🚀 Frontend - Sending study question, isRagMode: ${isRagMode}, isGeneral: ${!isRagMode}`);
      
      const response = await axios.post('http://localhost:5000/api/rag/ask', {
        question: studyPrompt,
        isGeneral: !isRagMode, // Use general mode for studying
      });
      console.log(`✅ Frontend - Received response successfully`);
      const botMessage = { sender: 'bot', text: response.data.answer };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(`❌ Frontend - Error:`, error);
      const errorMessage = { sender: 'bot', text: error.response?.data?.error || 'Sorry, I encountered an error while trying to help you study.' };
      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus(`Ready to upload: ${selectedFile.name}`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first.');
      return;
    }
    setIsLoading(true);
    setUploadStatus('📤 Analysing Document...');
    setChatHistory([]);
    const formData = new FormData();
    formData.append('pdfFile', file);
    try {
      const response = await axios.post('http://localhost:5000/api/rag/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('✅ PDF uploaded and processed successfully!');
      setIsRagMode(true);
      
      // Add a system message to chat
      setTimeout(() => {
        setChatHistory([{
          sender: 'bot',
          text: '🎉 **PDF Upload Complete!**\n\nYour document has been successfully processed and I\'m ready to answer questions about it. You can ask me to:\n\n- **Summarize** the main points\n- **Explain** specific concepts\n- **Find** particular information\n- **Compare** different sections\n\nWhat would you like to know about your document?'
        }]);
      }, 1000);
      
    } catch (error) {
      setUploadStatus(error.response?.data?.error || 'Error uploading file.');
      setIsRagMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    console.log(`🚀 Frontend - Sending question: "${question}", isRagMode: ${isRagMode}, isGeneral: ${!isRagMode}`);
    
    const userMessage = { sender: 'user', text: question };
    setIsLoading(true);
    setChatHistory((prev) => [...prev, userMessage]);
    setQuestion('');
    try {
      const response = await axios.post('http://localhost:5000/api/rag/ask', {
        question: question,
        isGeneral: !isRagMode,
      });
      console.log(`✅ Frontend - Received response successfully`);
      const botMessage = { sender: 'bot', text: response.data.answer };
      setChatHistory((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = { sender: 'bot', text: error.response?.data?.error || 'Sorry, I encountered an error.' };
      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDocument = () => {
    setIsRagMode(false);
    setUploadStatus('');
    setFile(null);
    setChatHistory([]);
  };


  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
      {/* Simple Header with Mode Selection */}
      <div className="flex-shrink-0 mb-6">
        <div className="p-6">
          {/* Simple Mode Toggle */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setIsRagMode(false);
                setChatHistory([]);
                setFile(null);
                setUploadStatus('');
                setStudyProcessed(false); // Reset study processing flag
                studyTaskRef.current = null; // Reset study task ref
              }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                !isRagMode 
                  ? 'bg-yellow-500 text-white shadow-lg transform scale-105' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              💬 General Chat
            </button>
            <button
              onClick={() => {
                setIsRagMode(true);
                setChatHistory([]);
                setFile(null);
                setUploadStatus('');
                setStudyProcessed(false); // Reset study processing flag
                studyTaskRef.current = null; // Reset study task ref
              }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                isRagMode 
                  ? 'bg-yellow-500 text-white shadow-lg transform scale-105' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📄 Chat with PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-grow flex flex-col min-h-0 px-6">
        {/* Chat Messages Area */}
        <div className="flex-grow overflow-y-auto mb-6 space-y-6 max-h-96 pr-2">
          {/* Upload Status Messages */}
          {isRagMode && uploadStatus && (
            <div className="flex justify-center mb-4">
              <div className="bg-blue-500/20 backdrop-blur-sm text-blue-200 px-4 py-2 rounded-lg text-sm">
                {uploadStatus}
              </div>
            </div>
          )}
          
          {/* PDF Processing Complete Message */}
          {isRagMode && uploadStatus.includes('processed successfully') && (
            <div className="flex justify-center mb-4">
              <div className="bg-green-500/20 backdrop-blur-sm text-green-200 px-4 py-2 rounded-lg text-sm">
                ✅ PDF uploaded successfully! Ask me anything about your document.
              </div>
            </div>
          )}
          
          {chatHistory.length === 0 && !uploadStatus && !location.state?.studyTask && (
            <div className="text-center py-12">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-4">
                  {isRagMode ? '📄' : '💬'}
                </div>
                <h3 className="text-xl font-semibold text-gray-200 mb-2">
                  {isRagMode ? 'Ready for PDF Chat!' : 'AI Assistant Ready!'}
                </h3>
                <p className="text-gray-400">
                  {isRagMode 
                    ? "Click the + button to upload a PDF and start asking questions about it."
                    : "Ask me anything! I can help with scheduling, planning, learning, or general questions."
                  }
                </p>
              </div>
            </div>
          )}
          
          {chatHistory.map((chat, index) => (
            <div key={index} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
              {chat.sender === 'user' ? (
                <div className="max-w-xl lg:max-w-2xl">
                  <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-white px-5 py-4 rounded-2xl rounded-br-md shadow-lg">
                    <p className="whitespace-pre-wrap leading-relaxed">{chat.text}</p>
                  </div>
                  <div className="flex items-center justify-end mt-2 text-xs text-gray-400">
                    <span>You</span>
                  </div>
                </div>
              ) : (
                <div className="max-w-none w-full">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      🤖
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="bg-gray-800/80 backdrop-blur-sm text-gray-100 px-6 py-4 rounded-2xl rounded-tl-md shadow-lg border border-gray-700/50">
                        <div className="prose prose-lg prose-invert max-w-none 
                                      prose-headings:text-yellow-400 prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4 
                                      prose-p:text-gray-200 prose-p:leading-relaxed prose-p:mb-4
                                      prose-strong:text-yellow-300 prose-strong:font-semibold
                                      prose-ul:space-y-2 prose-ol:space-y-2
                                      prose-li:text-gray-200 prose-li:leading-relaxed
                                      prose-code:bg-gray-700 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-yellow-300
                                      prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-600
                                      prose-table:border-collapse prose-table:w-full
                                      prose-th:bg-gray-700 prose-th:border prose-th:border-gray-600 prose-th:px-4 prose-th:py-2 prose-th:text-yellow-300 prose-th:font-semibold
                                      prose-td:border prose-td:border-gray-600 prose-td:px-4 prose-td:py-2 prose-td:text-gray-200
                                      prose-blockquote:border-l-4 prose-blockquote:border-yellow-500 prose-blockquote:pl-4 prose-blockquote:italic">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.text}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="flex items-center mt-2 text-xs text-gray-400">
                        <span>{isRagMode ? 'Document Assistant' : 'AI Assistant'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  🤖
                </div>
                <div className="bg-gray-800/80 backdrop-blur-sm text-gray-100 px-6 py-4 rounded-2xl rounded-tl-md shadow-lg border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <span className="ml-2 text-gray-300">AI is thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form with Plus Button for PDF */}
        <div className="flex-shrink-0 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50">
          <form onSubmit={handleAskQuestion} className="flex gap-3 items-center">
            {/* Plus Button for PDF Upload (only in PDF mode) */}
            {isRagMode && (
              <div className="flex-shrink-0">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  id="pdf-upload-plus"
                />
                <label 
                  htmlFor="pdf-upload-plus" 
                  className="w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl cursor-pointer transition-colors flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105"
                  title="Upload PDF"
                >
                  <span className="text-3xl font-bold leading-none">+</span>
                </label>
              </div>
            )}
            
            <div className="flex-grow">
              <input 
                type="text" 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                placeholder={isRagMode ? 
                  (uploadStatus.includes('processed successfully') ? "Ask about your document..." : "Upload a PDF first using the + button...") 
                  : "Ask me anything about scheduling, planning, or general topics..."
                } 
                className="w-full h-12 px-4 rounded-xl bg-gray-700/70 border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-200" 
                disabled={isLoading || (isRagMode && !uploadStatus.includes('processed successfully'))}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || !question.trim() || (isRagMode && !uploadStatus.includes('processed successfully'))} 
              className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none flex items-center justify-center flex-shrink-0"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5"/>
              )}
            </button>
          </form>
          
          {/* File Upload Status */}
          {isRagMode && file && !uploadStatus.includes('processed successfully') && (
            <div className="mt-3 p-3 bg-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-blue-400">�</div>
                  <span className="text-blue-200 text-sm">{file.name}</span>
                </div>
                <button 
                  onClick={handleUpload} 
                  disabled={isLoading} 
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-white px-3 py-1 rounded-lg transition-colors disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? '⏳ Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;