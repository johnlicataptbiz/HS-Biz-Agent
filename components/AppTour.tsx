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
    targetId: 'center-screen',
    title: 'Welcome to Core UI',
    description: 'This guide walks you through the upgraded operating system for HubSpot: clarity-first views, actionable cohorts, and AI-powered diagnostics. You can replay this anytime from the Guide button.',
    position: 'center'
  },
  {
    targetId: 'sidebar-container',
    title: 'Navigation Stack',
    description: 'Everything is organized into Core, Ops, and AI. Core is your daily command deck. Ops is deep diagnostics and reporting. AI is your execution layer for strategy and fixes.',
    position: 'right'
  },
  {
    targetId: 'connection-status',
    title: 'Portal Connection',
    description: 'This shows whether HubSpot is connected and live. If you see a warning light, open Settings to re-authenticate.',
    position: 'right'
  },
  {
    targetId: 'nav-link-contacts',
    title: 'Directory (Home Base)',
    description: 'This is the primary dashboard. It mirrors your CRM contacts and applies lead intelligence, segmentation, and sorting so you can act fast.',
    position: 'right',
    route: 'contacts'
  },
  {
    targetId: 'contacts-search-bar',
    title: 'Search Heuristics',
    description: 'Search by name, email, or company. Use this to quickly validate a lead or find a specific record before taking action.',
    position: 'bottom',
    route: 'contacts'
  },
  {
    targetId: 'contacts-segments-row',
    title: 'Strategic Segments',
    description: 'Switch between Hot, New, Nurture, Watch, Active Clients, and cleanup views. These segments are your operational lanes.',
    position: 'bottom',
    route: 'contacts'
  },
  {
    targetId: 'contacts-ai-rank-header',
    title: 'AI Lead Rank',
    description: 'Sort by score to see the highest priority leads. The score uses engagement, recency, and conversion signals.',
    position: 'bottom',
    route: 'contacts'
  },
  {
    targetId: 'contacts-data-grid',
    title: 'Lead Insights (Click Any Row)',
    description: 'Click a contact to open a CRM insight card. It shows why a lead is hot or critical: page views, conversions, source, and recency.',
    position: 'top',
    route: 'contacts'
  },
  {
    targetId: 'nav-link-campaigns',
    title: 'Campaign Intelligence',
    description: 'Marketing performance is ranked by revenue influence and volume. Use this to spot winners and underperformers immediately.',
    position: 'right',
    route: 'campaigns'
  },
  {
    targetId: 'campaigns-grid',
    title: 'Campaign Cards + HubSpot Link',
    description: 'Cards are clickable. Open a lightweight insight panel, then jump to the campaign in HubSpot with one click.',
    position: 'top',
    route: 'campaigns'
  },
  {
    targetId: 'nav-link-sequences',
    title: 'Sequences',
    description: 'Audit outbound sequences for engagement quality. Use Draft New Persona for AI-powered messaging and segmentation strategy.',
    position: 'right',
    route: 'sequences'
  },
  {
    targetId: 'nav-link-journey',
    title: 'Journey Map',
    description: 'Visualize lifecycle flow from discovery to retention. This highlights where automation gaps or drop-offs happen.',
    position: 'right',
    route: 'journey'
  },
  {
    targetId: 'journey-funnel',
    title: 'Stage-by-Stage Conversion',
    description: 'Each stage shows volume, drop-off, and automation coverage (workflows + sequences). Use it to prioritize fixes.',
    position: 'top',
    route: 'journey'
  },
  {
    targetId: 'nav-link-workflows',
    title: 'Workflows',
    description: 'A full workflow inventory with AI audit flags. Fix issues fast by opening an optimization prompt.',
    position: 'right',
    route: 'workflows'
  },
  {
    targetId: 'workflows-table',
    title: 'Workflow Diagnostics',
    description: 'This table highlights logic debt, broken branches, and optimization opportunities across your automation stack.',
    position: 'top',
    route: 'workflows'
  },
  {
    targetId: 'nav-link-data-model',
    title: 'Data Model',
    description: 'Schema integrity controls reporting accuracy. Run audits to detect missing properties, inconsistent fields, and structural drift.',
    position: 'right',
    route: 'data-model'
  },
  {
    targetId: 'run-audit-btn',
    title: 'Run Model Audit',
    description: 'Launch a structural scan that flags CRM field gaps and suggests concrete fixes.',
    position: 'left',
    route: 'data-model'
  },
  {
    targetId: 'ai-chat-trigger',
    title: 'Global AI Command',
    description: 'Access the AI assistant from anywhere for quick actions, deep analysis, or operational troubleshooting.',
    position: 'left'
  },
  {
    targetId: 'sidebar-settings-btn',
    title: 'Secure Tunnel Settings',
    description: 'Reconnect HubSpot, manage tokens, and enable diagnostic tools. Use this if you see sync failures.',
    position: 'right'
  },
  {
    targetId: 'sidebar-guide-btn',
    title: 'Replay This Guide',
    description: 'Click Guide anytime to re-open this walkthrough.',
    position: 'right'
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

  // Scroll to element when step changes
  useEffect(() => {
    if (isOpen && currentStep >= 0) {
        const step = TOUR_STEPS[currentStep];
        if (step && step.targetId) {
            const el = document.getElementById(step.targetId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }
    }
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Calculate Popover Position with Boundary Detection
  const getPopoverStyle = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 20;
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT = 200; // Approx height
    const SCREEN_PADDING = 20;

    let top = 0;
    let left = 0;
    let newPos = step.position;

    // Helper to check if rect fits
    const checkFit = (t: number, l: number) => {
        return (
            t >= SCREEN_PADDING &&
            l >= SCREEN_PADDING &&
            t + POPOVER_HEIGHT <= window.innerHeight - SCREEN_PADDING &&
            l + POPOVER_WIDTH <= window.innerWidth - SCREEN_PADDING
        );
    };

    // calculate initial coords based on preferred position
    // define getCoords ...
    const getCoords = (pos: string) => {
        switch (pos) {
            case 'right':
                return {
                    top: targetRect.top + (targetRect.height / 2) - 100,
                    left: targetRect.right + gap
                };
            case 'left':
                return {
                    top: targetRect.top + (targetRect.height / 2) - 100,
                    left: targetRect.left - gap - POPOVER_WIDTH
                };
            case 'bottom':
                return {
                    top: targetRect.bottom + gap,
                    left: targetRect.left + (targetRect.width / 2) - (POPOVER_WIDTH / 2)
                };
            case 'top':
                return {
                    top: targetRect.top - gap - POPOVER_HEIGHT,
                    left: targetRect.left + (targetRect.width / 2) - (POPOVER_WIDTH / 2)
                };
            default:
                return { top: 0, left: 0 };
        }
    };

    let coords = getCoords(newPos);

    // Auto-flip logic
    if (!checkFit(coords.top, coords.left)) {
        const flipMap: Record<string, string> = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
        if (flipMap[newPos]) {
            const flippedCoords = getCoords(flipMap[newPos]);
            if (checkFit(flippedCoords.top, flippedCoords.left)) {
                coords = flippedCoords;
            }
        }
    }

    // Safety Clamp (ensure it never goes fully off screen)
    // We add a safety margin of 20px
    const SAFE_MARGIN = 20;
    const MAX_TOP = window.innerHeight - POPOVER_HEIGHT - SAFE_MARGIN;
    const MAX_LEFT = window.innerWidth - POPOVER_WIDTH - SAFE_MARGIN;

    coords.top = Math.max(SAFE_MARGIN, Math.min(coords.top, MAX_TOP));
    coords.left = Math.max(SAFE_MARGIN, Math.min(coords.left, MAX_LEFT));

    return {
        top: coords.top,
        left: coords.left
    };
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
        <div className="glass-card border border-slate-200 shadow-[0_0_50px_rgba(99,102,241,0.2)] p-6 relative overflow-hidden bg-white/90 backdrop-blur-xl">
           {/* Background Deco */}
           <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>

           <div className="relative z-10">
               <div className="flex justify-between items-start mb-4">
                   <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-slate-900 shadow-lg">
                       <BrainCircuit size={20} />
                   </div>
                   <button onClick={onClose} title="Dismiss Tour" className="text-slate-500 hover:text-slate-900 transition-colors">
                       <X size={16} />
                   </button>
               </div>

               <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
               <p className="text-slate-600 text-sm leading-relaxed mb-6">
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
