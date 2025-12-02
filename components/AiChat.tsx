import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, Terminal, CheckCircle2, Loader2, ChevronDown, ChevronRight, Zap, MessageSquare } from 'lucide-react';
import { generateChatResponse } from '../services/aiService';
import { ChatResponse } from '../types';
import { hubSpotService } from '../services/hubspotService';
import { getBreezeTools } from '../services/mockService'; // Using mock for now as Breeze tools aren't on public API yet

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

  const executeToolCall = async (toolName: string): Promise<any> => {
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
        const tools = await getBreezeTools();
        return {
          count: tools.length,
          names: tools.map(t => t.name)
        };
      default:
        return { error: "Unknown Tool" };
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setSuggestions([]);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const aiData = await generateChatResponse(userMessage.content);
      
      // 1. Add the textual response
      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'assistant',
        content: aiData.text
      };
      setMessages(prev => [...prev, botMessage]);
      setSuggestions(aiData.suggestions || []);

      // 2. Handle Tool Calls (The Agent Loop Simulation)
      if (aiData.toolCalls && aiData.toolCalls.length > 0) {
        for (const tool of aiData.toolCalls) {
            // Add a "Thinking/Executing" indicator (could be a separate message or state)
            // For simplicity, we append a message that updates.
            
            const toolMsgId = (Date.now() + 2).toString();
            try {
                const result = await executeToolCall(tool.name);
                
                // Construct a Tool Result Message
                const toolMessage: Message = {
                    id: toolMsgId,
                    role: 'assistant',
                    content: `Executed tool: ${tool.name}`,
                    toolCallResult: {
                        toolName: tool.name,
                        status: 'success',
                        dataSummary: `Retrieved ${result.count || 0} items successfully.`,
                        rawData: result
                    }
                };
                setMessages(prev => [...prev, toolMessage]);

            } catch (e) {
                const errorMessage: Message = {
                    id: toolMsgId,
                    role: 'assistant',
                    content: `Failed to execute ${tool.name}`,
                    toolCallResult: {
                        toolName: tool.name,
                        status: 'error',
                        dataSummary: "Connection or API Error",
                        rawData: { error: String(e) }
                    }
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        }
      }

      // 3. Handle UI Action (Modal Open)
      if (aiData.action && onTriggerAction) {
        onTriggerAction(aiData.action);
      }

    } catch (error) {
      console.error(error);
      setSuggestions(["Retry"]);
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
        onClick={() => setIsOpen(true)}
        className="group fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl shadow-2xl shadow-indigo-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 z-50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <Sparkles size={26} className="group-hover:rotate-12 transition-transform relative z-10" />
        {/* Notification dot */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
          <Zap size={8} className="text-white" />
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 w-[420px] h-[650px] max-h-[85vh] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/60 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="relative px-5 py-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base">Co-Pilot Chat</h3>
              <div className="flex items-center gap-1.5 text-xs text-indigo-200">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                MCP Agent Active
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Standard Message Bubble */}
            <div
              className={`max-w-[85%] p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-md shadow-lg shadow-indigo-500/20'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-md shadow-sm'
              }`}
            >
               {msg.role === 'assistant' && !msg.toolCallResult && (
                 <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                   <div className="p-1 bg-indigo-50 rounded-lg">
                     <Bot size={12} className="text-indigo-500" />
                   </div>
                   <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Assistant</span>
                 </div>
               )}
               {msg.content}
            </div>

            {/* Tool Execution Result Card */}
            {msg.toolCallResult && (
              <div className="mt-2 w-[90%] max-w-full">
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden text-xs shadow-lg">
                  <div 
                    className="flex items-center justify-between p-3 bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors"
                    onClick={() => toggleToolDetails(msg.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-indigo-500/20 rounded">
                        <Terminal size={12} className="text-indigo-400" />
                      </div>
                      <span className="font-mono font-semibold text-slate-200">{msg.toolCallResult.toolName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.toolCallResult.status === 'success' ? (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={12} />
                          <span className="text-[10px] font-semibold">Success</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-semibold">Error</span>
                      )}
                      {expandedTools[msg.id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    </div>
                  </div>
                  
                  <div className="p-3 border-t border-slate-700 bg-slate-900">
                    <p className="text-slate-300">{msg.toolCallResult.dataSummary}</p>
                    
                    {expandedTools[msg.id] && (
                      <pre className="mt-3 bg-slate-950 text-emerald-300 p-3 rounded-lg overflow-x-auto font-mono text-[10px] border border-slate-800">
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
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-md shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400 font-medium">Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isTyping && (
        <div className="px-4 pb-3 bg-white border-t border-slate-100 pt-3 flex gap-2 flex-wrap">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(suggestion)}
              className="text-xs bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask to audit workflows, data, etc..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 transition-all"
          />
          <button
            onClick={() => handleSend(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              !inputValue.trim() || isTyping
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiChat;