import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, Terminal, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { generateChatResponse } from '../services/aiService';
import { ChatResponse } from '../types';
import { hubSpotService } from '../services/hubspotService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCallResult?: {
    toolName: string;
    status: 'success' | 'error';
    dataSummary: string;
    rawData: any;
  };
}

interface AiChatProps {
  onTriggerAction?: (action: NonNullable<ChatResponse['action']>) => void;
}

const AiChat: React.FC<AiChatProps> = ({ onTriggerAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your HubSpot Co-Pilot. I can help you find optimization opportunities across your portal. What would you like to check today?"
    }
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Audit my workflows",
    "Check data health",
    "Draft a cold sequence",
    "Optimize discovery funnel"
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Track open/close state of tool result details
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  const toggleToolDetails = (msgId: string) => {
    setExpandedTools(prev => ({...prev, [msgId]: !prev[msgId]}));
  };

  const executeToolCall = async (toolName: string, toolArgs: any = {}): Promise<any> => {
    // Mapping tool names (from AI) to service functions
    switch (toolName) {
      case 'list_workflows':
        const wfs = await hubSpotService.fetchWorkflows();
        return {
          count: wfs.length,
          items: wfs.map(w => ({ name: w.name, score: w.aiScore, issues: w.issues.length }))
        };
      case 'audit_data_schema':
        const props = await hubSpotService.fetchProperties();
        return {
          count: props.length,
          redundant: props.filter(p => p.redundant).length,
          lowUsage: props.filter(p => p.usage < 10).length
        };
      case 'list_sequences':
        const seqs = await hubSpotService.fetchSequences();
        return {
          count: seqs.length,
          avgReply: Math.round(seqs.reduce((acc, s) => acc + s.replyRate, 0) / (seqs.length || 1)) + '%'
        };
      case 'get_breeze_tools':
        const tools = await hubSpotService.fetchBreezeTools();
        return {
          count: tools.length,
          names: tools.map(t => t.name)
        };
      case 'search_contacts':
        const contacts = await hubSpotService.searchContacts(toolArgs.query || ''); 
        return {
          count: contacts.length,
          results: contacts.map(c => ({ id: c.id, email: c.properties.email }))
        };
      case 'get_contact':
        const contact = await hubSpotService.getContact(toolArgs.id || '1');
        return contact;
      case 'list_newest_contacts':
        const newest = await hubSpotService.listNewestContacts();
        return {
          count: newest.length,
          items: newest.map(n => ({ id: n.id, created: n.createdAt, email: n.properties.email }))
        };
      case 'search_companies':
        const companies = await hubSpotService.searchCompanies(toolArgs.query || '');
        return {
          count: companies.length,
          items: companies.map(c => ({ id: c.id, name: c.properties.name }))
        };
      default:
        return { error: "Unknown Tool" };
    }
  };

  const handleSend = async (text: string, isAutoRetry = false) => {
    if (!text.trim()) return;

    if (!isAutoRetry) {
        setSuggestions([]);
        const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
    }
    
    setIsTyping(true);

    try {
      const aiData = await generateChatResponse(text);
      
      // If the response is a quota error but we haven't retried yet, the service handles it.
      // But if it still comes back as "The AI is managing tight rate limits", we show a special UI.

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'assistant',
        content: aiData.text
      };
      setMessages(prev => [...prev, botMessage]);
      setSuggestions(aiData.suggestions || []);

      // 2. Handle UI Action (Modal Open)
      if (aiData.action && onTriggerAction) {
        onTriggerAction(aiData.action);
      }

    } catch (error: any) {
      console.error(error);
      const isQuota = error.message?.includes("429") || error.message?.includes("quota");
      
      if (isQuota && !isAutoRetry) {
          // Silent internal retry after 2 seconds
          setTimeout(() => handleSend(text, true), 3000);
          return;
      }

      setSuggestions(["Retry"]);
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "System: I encountered a rate limit or connection issue. If you have a paid Gemini key, please add it in Settings to skip these limits."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="ai-chat-trigger"
        onClick={() => setIsOpen(true)}
        title="Open Co-Pilot Chat"
        aria-label="Open AI Co-Pilot Chat"
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-900/30 flex items-center justify-center transition-all hover:scale-105 z-50 group"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 w-96 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500 rounded-lg">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Co-Pilot Chat</h3>
            <p className="text-xs text-indigo-200">MCP Agent Active</p>
          </div>
        </div>
        <button
          id="close-chat-btn"
          onClick={() => setIsOpen(false)}
          title="Close Chat"
          aria-label="Close chat"
          className="p-1 hover:bg-indigo-500 rounded transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Standard Message Bubble */}
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
              }`}
            >
               {msg.role === 'assistant' && !msg.toolCallResult && (
                 <Bot size={14} className="inline-block mr-2 text-indigo-500 mb-0.5" />
               )}
               {msg.content}
            </div>

            {/* Tool Execution Result Card */}
            {msg.toolCallResult && (
                <div className="mt-2 w-[90%] max-w-full">
                    <div className="bg-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                        <div 
                            className="flex items-center justify-between p-2 bg-slate-200 cursor-pointer hover:bg-slate-300 transition-colors"
                            onClick={() => toggleToolDetails(msg.id)}
                        >
                            <div className="flex items-center gap-2">
                                <Terminal size={12} className="text-slate-400" />
                                <span className="font-mono font-semibold text-slate-700">{msg.toolCallResult.toolName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {msg.toolCallResult.status === 'success' ? (
                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                )}
                                {expandedTools[msg.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                        </div>
                        
                        <div className="p-2 border-t border-slate-200 bg-white">
                            <p className="text-slate-400 mb-1">{msg.toolCallResult.dataSummary}</p>
                            
                            {expandedTools[msg.id] && (
                                <pre className="mt-2 bg-slate-900 text-emerald-300 p-2 rounded overflow-x-auto font-mono text-[10px]">
                                    {JSON.stringify(msg.toolCallResult.rawData, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
               <Loader2 size={14} className="animate-spin text-indigo-500" />
               <span className="text-xs text-slate-400 font-medium">Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isTyping && (
        <div className="px-4 pb-2 bg-slate-50 flex gap-2 flex-wrap">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              id={`chat-suggestion-${idx}`}
              onClick={() => handleSend(suggestion)}
              aria-label={`Ask AI: ${suggestion}`}
              className="text-xs bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input
            id="chat-input-field"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask to audit workflows, data, etc..."
            aria-label="Ask the AI co-pilot"
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
          />
          <button
            id="send-message-btn"
            onClick={() => handleSend(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            title="Send Message"
            aria-label="Send message"
            className={`p-2 rounded-full ${
              !inputValue.trim() || isTyping
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } transition-colors flex-shrink-0`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiChat;