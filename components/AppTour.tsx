import React, { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles, BrainCircuit } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'right' | 'left' | 'top' | 'bottom' | 'center';
  route?: string; // Tab to switch to
}

interface AppTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigate: (tab: string) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'center-screen', // specialized handling
    title: 'Welcome to AI Optimizer',
    description: 'Your intelligent command center for HubSpot revenue architecture. Let\'s get you oriented.',
    position: 'center'
  },
  {
    targetId: 'sidebar-container',
    title: 'Command Center',
    description: 'Navigate between your key revenue engines: Workflows, Campaigns, and the new Journey Map.',
    position: 'right'
  },
  {
    targetId: 'connection-status',
    title: 'Live Neural Link',
    description: 'Real-time sync status with your HubSpot portal. We monitor api limits and data health.',
    position: 'right'
  },
  {
    targetId: 'nav-link-journey',
    title: 'Revenue Journey',
    description: 'Visualize your entire customer path. Identify leakage from Cold Contact to Closed Deal.',
    position: 'right',
    route: 'dashboard'
  },
  {
    targetId: 'draft-workflow-btn',
    title: 'Workflow Audit',
    description: 'Identify ghost workflows and redundant enrollments. Let the AI optimize your automation logic.',
    position: 'bottom',
    route: 'workflows'
  },
  {
    targetId: 'optimize-sequence-btn',
    title: 'Sequence Intelligence',
    description: 'Analyze reply rates and sentiment. The AI can rewrite steps to improve conversion.',
    position: 'bottom',
    route: 'sequences'
  },
  {
    targetId: 'clean-up-contacts-btn',
    title: 'Data Hygiene',
    description: 'Find duplicates and unclassified records. Execute bulk cleanups with confidence.',
    position: 'bottom',
    route: 'contacts'
  },
  {
    targetId: 'run-audit-btn',
    title: 'Schema Architecture',
    description: 'Visualize your entire data model. Identify unused properties and structural debt.',
    position: 'bottom',
    route: 'datamodel'
  },
  {
    targetId: 'draft-tool-btn',
    title: 'Breeze Tools',
    description: 'Extend HubSpot with custom UI cards. The AI drafts the React/Node.js code for you.',
    position: 'bottom',
    route: 'breezetools'
  },
  {
    targetId: 'global-search-btn',
    title: 'Heuristic Search',
    description: 'Quickly find specific automations, contacts, or logic gaps using semantic search.',
    position: 'bottom'
  },
  {
    targetId: 'ai-chat-trigger',
    title: 'AI Co-Pilot',
    description: 'Your 24/7 Analyst. Ask it to audit workflows, draft plans, or fix data issues instantly.',
    position: 'left'
  }
];

const AppTour: React.FC<AppTourProps> = ({ isOpen, onClose, onComplete, onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleStepChange(currentStep);
      window.addEventListener('resize', () => {
         // simple refresh
         handleStepChange(currentStep);
      });
      return () => window.removeEventListener('resize', () => {});
    }
  }, [isOpen, currentStep]);

  const handleStepChange = (stepIdx: number) => {
      const step = TOUR_STEPS[stepIdx];
      
      // 1. Navigation Logic
      if (step.route) {
          onNavigate(step.route);
          // Wait for render
          setTimeout(() => updatePosition(step.targetId), 400); 
      } else {
          updatePosition(step.targetId);
      }
  };

  const updatePosition = (targetId: string) => {
    if (targetId === 'center-screen') {
        setTargetRect(null);
        return;
    }

    const findAndSet = () => {
        const element = document.getElementById(targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
    };

    // Immediate check
    if (!findAndSet()) {
       // Poll for it (since route change might fade in)
       let attempts = 0;
       const interval = setInterval(() => {
           if (findAndSet() || attempts > 5) clearInterval(interval);
           attempts++;
       }, 200);
    }
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Calculate Popover Position
  const getPopoverStyle = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 20;
    
    switch (step.position) {
      case 'right':
        return {
          top: targetRect.top + (targetRect.height / 2) - 100, // Center roughly
          left: targetRect.right + gap,
        };
      case 'left':
        return {
          top: targetRect.top + (targetRect.height / 2) - 100,
          right: window.innerWidth - targetRect.left + gap,
        };
      case 'bottom':
        return {
          top: targetRect.bottom + gap,
          left: targetRect.left + (targetRect.width / 2) - 150,
        };
      case 'top':
        return {
          bottom: window.innerHeight - targetRect.top + gap,
          left: targetRect.left + (targetRect.width / 2) - 150,
        };
      default:
        return {};
    }
  };

  return (
    <div className="fixed inset-0 z-[100] animate-in fade-in duration-500 font-['Outfit']">
      
      {/* 1. Spotlight Overlay (SVG Mask) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {targetRect && (
              <rect 
                x={targetRect.left - 5} 
                y={targetRect.top - 5} 
                width={targetRect.width + 10} 
                height={targetRect.height + 10} 
                rx="8" 
                fill="black" 
                className="transition-all duration-500 ease-in-out"
              />
            )}
          </mask>
        </defs>
        <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="rgba(15, 23, 42, 0.85)" 
            mask="url(#spotlight-mask)" 
        />
        
        {/* Glowing border around target */}
        {targetRect && (
            <rect 
                x={targetRect.left - 5}
                y={targetRect.top - 5}
                width={targetRect.width + 10}
                height={targetRect.height + 10}
                rx="8"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                className="transition-all duration-500 ease-in-out animate-pulse"
            />
        )}
      </svg>

      {/* 2. Interactive Card */}
      <div 
        className="absolute transition-all duration-500 ease-in-out w-[320px]"
        style={getPopoverStyle()}
      >
        <div className="glass-card border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.2)] p-6 relative overflow-hidden bg-[#0a0f1d]/90 backdrop-blur-xl">
           {/* Background Deco */}
           <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>

           <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                   <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                       <BrainCircuit size={20} />
                   </div>
                   <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                       <X size={16} />
                   </button>
               </div>

               <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
               <p className="text-slate-400 text-sm leading-relaxed mb-6">
                   {step.description}
               </p>

               <div className="flex items-center justify-between">
                   <div className="flex gap-1">
                       {TOUR_STEPS.map((_, idx) => (
                           <div 
                             key={idx} 
                             className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-700'}`} 
                           />
                       ))}
                   </div>

                   <button 
                     onClick={() => {
                         if (isLastStep) {
                             onComplete();
                         } else {
                             setCurrentStep(prev => prev + 1);
                         }
                     }}
                     className="px-4 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 transition-colors flex items-center gap-2"
                   >
                       {isLastStep ? 'Finish' : 'Next'} <ArrowRight size={12} />
                   </button>
               </div>
           </div>
        </div>
      </div>

    </div>
  );
};

export default AppTour;
